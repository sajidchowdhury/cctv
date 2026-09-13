/**
 * GET /api/warranty/lookup (doc §5.1, F3-S1 fix)
 *
 * Search by: serial number OR product name/model.
 * Returns ALL inventory units (not just SOLD) with full history:
 *   - Purchase details (invoice, date, supplier, price, warranty months)
 *   - Sale details (invoice, date, customer, price)
 *   - Warranty status (active/expired/not applicable, end date, days remaining)
 *   - RMA records (if any)
 *
 * "Not applicable" for units without warranty.
 * "Not yet sold" for units in stock.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const serial = (url.searchParams.get("serial") ?? "").trim();
  const searchQuery = q || serial;

  if (!searchQuery) {
    return NextResponse.json(
      { error: "Provide a search query (serial number or product name)." },
      { status: 422 }
    );
  }

  // Find inventory units matching serial OR product name/model/SKU.
  const units = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      OR: [
        { serialNo: { contains: searchQuery } },
        {
          product: {
            OR: [
              { name: { contains: searchQuery } },
              { model: { contains: searchQuery } },
              { sku: { contains: searchQuery } },
            ],
          },
        },
      ],
    },
    include: {
      product: { select: { id: true, name: true, model: true, sku: true } },
      purchase: {
        select: { id: true, invoiceNo: true, date: true, supplier: { select: { name: true } } },
      },
      purchaseItem: {
        select: { unitPrice: true, warrantyMonths: true, salesPrice: true },
      },
      saleItem: {
        include: {
          sale: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
      rmaTickets: {
        select: { id: true, rmaNo: true, stage: true, dateOpened: true, faultReason: true, closedAt: true },
        orderBy: { dateOpened: "desc" },
      },
      serviceTickets: {
        select: { id: true, issue: true, status: true, charge: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const result = units.map((u) => {
    const purchase = u.purchase;
    const purchaseItem = u.purchaseItem;
    const sale = u.saleItem?.sale;
    const warrantyEnd = u.warrantyEnd;
    const hasWarranty = warrantyEnd !== null;
    const inWarranty = hasWarranty ? new Date(warrantyEnd!) > now : false;
    const daysLeft = hasWarranty
      ? Math.ceil((new Date(warrantyEnd!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      id: u.id,
      serialNo: u.serialNo,
      status: u.status,
      productName: u.product.name,
      productModel: u.product.model,
      productSku: u.product.sku,
      // Purchase details
      purchaseInvoice: purchase?.invoiceNo ?? null,
      purchaseDate: purchase?.date ?? null,
      purchaseSupplier: purchase?.supplier?.name ?? null,
      purchasePrice: purchaseItem?.unitPrice ?? null,
      warrantyMonths: purchaseItem?.warrantyMonths ?? null,
      // Sale details
      saleInvoice: sale?.invoiceNo ?? null,
      saleDate: sale?.date ?? null,
      saleCustomer: sale?.customer?.name ?? null,
      saleCustomerPhone: sale?.customer?.phone ?? null,
      salePrice: u.saleItem?.unitPrice ?? null,
      // Warranty
      warrantyEnd: warrantyEnd?.toISOString() ?? null,
      warrantyStatus: !hasWarranty ? "not_applicable" : inWarranty ? "active" : "expired",
      daysLeft,
      // RMA
      rmaTickets: u.rmaTickets.map((r) => ({
        rmaNo: r.rmaNo,
        stage: r.stage,
        dateOpened: r.dateOpened.toISOString(),
        faultReason: r.faultReason,
        closedAt: r.closedAt?.toISOString() ?? null,
      })),
      // Service tickets
      serviceTickets: u.serviceTickets.map((s) => ({
        issue: s.issue,
        status: s.status,
        charge: s.charge,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  });

  return NextResponse.json({ units: result, count: result.length });
});
