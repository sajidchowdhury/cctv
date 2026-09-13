/**
 * GET /api/purchases/[id] — fetch a single purchase with items + inventory units.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, company: true, phone: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, model: true, sku: true } },
          inventoryUnits: { select: { id: true, serialNo: true, status: true, warrantyEnd: true } },
        },
      },
    },
  });
  if (!purchase || purchase.deletedAt) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }
  return NextResponse.json({
    purchase: {
      id: purchase.id,
      invoiceNo: purchase.invoiceNo,
      date: purchase.date,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name ?? "Walk-in",
      supplier: purchase.supplier,
      total: purchase.total,
      paid: purchase.paid,
      due: purchase.due,
      mode: purchase.mode,
      notes: purchase.notes,
      items: purchase.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product.name,
        productModel: it.product.model,
        productSku: it.product.sku,
        qty: it.qty,
        unitPrice: it.unitPrice,
        salesPrice: it.salesPrice,
        warrantyMonths: it.warrantyMonths,
        lineTotal: it.lineTotal,
        serials: JSON.parse(it.serials) as string[],
        inventoryUnits: it.inventoryUnits,
      })),
    },
  });
});
