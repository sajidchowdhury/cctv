/**
 * GET /api/inventory-units — list inventory units with stock availability (doc §4.3).
 *
 * Query: productId (filter), status (default IN_STOCK), search (serialNo).
 * Used by the sales screen for live stock + serial lookup, AND by the RMA
 * new page for serial-based auto-detection of customer/vendor (Phase 4).
 *
 * Phase 4 / Feature #7: response now includes the unit's sale + purchase
 * history so the RMA form can auto-fill customer + supplier when a serial
 * is selected. The fields are:
 *   - lastSale: { saleId, invoiceNo, date, customerId, customerName, customerPhone, unitPrice }
 *     (null if the unit was never sold / sale soft-deleted)
 *   - purchase: { purchaseId, invoiceNo, date, supplierId, supplierName, supplierPhone, unitPrice }
 *     (null if the unit has no purchase record — e.g. opening stock)
 *
 * Note: take limit lowered from 200 → 50 because the additional includes
 * make each row heavier. RMA lookup is by serial — typically returns ≤5
 * results — so the lower cap is fine.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") ?? undefined;
  const status = url.searchParams.get("status") ?? "IN_STOCK";
  const search = url.searchParams.get("q") ?? "";

  const units = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      ...(productId ? { productId } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(search ? { serialNo: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      product: { select: { id: true, name: true, model: true, sku: true } },
      // Phase 4: include saleItem → sale → customer for the RMA auto-fill.
      saleItem: {
        include: {
          sale: {
            where: { deletedAt: null },
            select: {
              id: true,
              invoiceNo: true,
              date: true,
              customerId: true,
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
      // Phase 4: include purchaseItem → purchase → supplier for the RMA auto-fill.
      purchaseItem: {
        include: {
          purchase: {
            where: { deletedAt: null },
            select: {
              id: true,
              invoiceNo: true,
              date: true,
              supplierId: true,
              supplier: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    inventoryUnits: units.map((u) => {
      // Sale info: only present if saleItem exists + its sale is not deleted.
      const sale = u.saleItem?.sale;
      const lastSale = sale
        ? {
            saleId: sale.id,
            invoiceNo: sale.invoiceNo,
            date: sale.date,
            customerId: sale.customerId,
            customerName: sale.customer?.name ?? null,
            customerPhone: sale.customer?.phone ?? null,
            salePrice: u.saleItem?.unitPrice ?? null,
          }
        : null;

      // Purchase info: only present if purchaseItem exists + its purchase is not deleted.
      const purchase = u.purchaseItem?.purchase;
      const purchaseInfo = purchase
        ? {
            purchaseId: purchase.id,
            invoiceNo: purchase.invoiceNo,
            date: purchase.date,
            supplierId: purchase.supplierId,
            supplierName: purchase.supplier?.name ?? null,
            supplierPhone: purchase.supplier?.phone ?? null,
            unitPrice: u.purchaseItem?.unitPrice ?? null,
          }
        : null;

      return {
        id: u.id,
        serialNo: u.serialNo,
        status: u.status,
        warrantyEnd: u.warrantyEnd,
        productId: u.productId,
        productName: u.product.name,
        productModel: u.product.model,
        productSku: u.product.sku,
        // Phase 4: history fields for the RMA auto-fill.
        lastSale,
        purchase: purchaseInfo,
      };
    }),
    count: units.length,
  });
});
