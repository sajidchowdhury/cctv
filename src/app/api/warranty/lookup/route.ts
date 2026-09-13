/**
 * GET /api/warranty/lookup (doc §5.1)
 *
 * Look up warranty status by serial number or customer phone.
 * Returns the inventory unit + linked sale + customer + warranty window.
 *
 * Used by the /warranty screen + the service-ticket flow (S22).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const serial = url.searchParams.get("serial") ?? "";
  const phone = url.searchParams.get("phone") ?? "";

  if (!serial && !phone) {
    return NextResponse.json(
      { error: "Provide a serial or phone parameter." },
      { status: 422 }
    );
  }

  // Find SOLD inventory units matching serial or customer phone.
  const units = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      status: "SOLD",
      ...(serial ? { serialNo: { contains: serial } } : {}),
    },
    include: {
      product: { select: { id: true, name: true, model: true, sku: true } },
      saleItem: {
        include: {
          sale: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  // Filter by phone if provided (on the linked customer).
  const filtered = phone
    ? units.filter((u) => u.saleItem?.sale?.customer?.phone?.includes(phone))
    : units;

  const now = new Date();
  const result = filtered.map((u) => {
    const sale = u.saleItem?.sale;
    const warrantyEnd = u.warrantyEnd;
    const inWarranty = warrantyEnd ? warrantyEnd > now : false;
    return {
      id: u.id,
      serialNo: u.serialNo,
      status: u.status,
      warrantyEnd,
      inWarranty,
      productName: u.product.name,
      productModel: u.product.model,
      productSku: u.product.sku,
      saleInvoice: sale?.invoiceNo ?? null,
      saleDate: sale?.date ?? null,
      customerName: sale?.customer?.name ?? null,
      customerPhone: sale?.customer?.phone ?? null,
    };
  });

  return NextResponse.json({ units: result, count: result.length });
});
