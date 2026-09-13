/**
 * GET /api/reports/stock-summary — product-wise on-hand qty, stock value, low-stock
 * flag (doc §5.3 Stock Summary report preview; full report in S18).
 *
 * Stock value = on-hand × last purchase price (from the latest PurchaseItem
 * for each product). Products with no purchases yet have value 0.
 *
 * F1-S2: onHand branches on product.isSerialised.
 *   - Serialised: onHand = count of IN_STOCK InventoryUnit rows.
 *   - Non-serialised: onHand = ΣPurchaseItem.qty − ΣSaleItem.qty.
 *
 * Returns: per-product rows + totals (totalUnits, totalValue, lowStockCount).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const lowStockOnly = url.searchParams.get("lowStock") === "1";

  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      model: true,
      safetyStock: true,
      isSerialised: true,
      category: { select: { name: true } },
      unit: { select: { name: true } },
      purchaseItems: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { unitPrice: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Compute onHand via shared helper (handles both serialised + non-serialised).
  const onHandMap = await computeOnHandBatch(
    db,
    user.tenantId!,
    products.map((p) => ({ id: p.id, isSerialised: p.isSerialised }))
  );

  let rows = products.map((p) => {
    const onHand = onHandMap.get(p.id) ?? 0;
    const lastCost = p.purchaseItems[0]?.unitPrice ?? 0;
    const value = onHand * lastCost;
    const lowStock = p.safetyStock > 0 && onHand <= p.safetyStock;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      model: p.model,
      categoryName: p.category?.name ?? null,
      unitName: p.unit?.name ?? null,
      isSerialised: p.isSerialised,
      onHand,
      safetyStock: p.safetyStock,
      lastCost,
      stockValue: value,
      lowStock,
      deficit: lowStock ? p.safetyStock - onHand : 0,
    };
  });

  if (lowStockOnly) {
    rows = rows.filter((r) => r.lowStock);
  }

  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.stockValue, 0);
  const lowStockCount = rows.filter((r) => r.lowStock).length;

  return NextResponse.json({
    rows,
    totals: {
      productCount: rows.length,
      totalUnits,
      totalValue,
      lowStockCount,
    },
  });
});
