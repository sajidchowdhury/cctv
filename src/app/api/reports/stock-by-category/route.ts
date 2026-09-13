/**
 * GET /api/reports/stock-by-category — stock qty + value grouped by category (F4-S2).
 *
 * Snapshot report (no date range — stock is a point-in-time value).
 * Returns:
 *   {
 *     categories: [{ name, productCount, totalQty, stockValue, products: [...] }],
 *     totals: { categoryCount, productCount, totalQty, totalValue }
 *   }
 *
 * Drill-down: each category carries its `products[]` array so the UI can expand
 * to show per-product rows without a second API call.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, _req: Request) => {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true, sku: true, model: true,
      safetyStock: true, isSerialised: true,
      categoryId: true,
      category: { select: { name: true } },
      unit: { select: { name: true } },
      purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, select: { unitPrice: true } },
    },
    orderBy: { name: "asc" },
  });

  const onHandMap = await computeOnHandBatch(
    db, user.tenantId!,
    products.map((p) => ({ id: p.id, isSerialised: p.isSerialised }))
  );

  // Build per-product row.
  const productRows = products.map((p) => {
    const onHand = onHandMap.get(p.id) ?? 0;
    const lastCost = p.purchaseItems[0]?.unitPrice ?? 0;
    const stockValue = onHand * lastCost;
    return {
      id: p.id, name: p.name, sku: p.sku, model: p.model,
      categoryName: p.category?.name ?? "Uncategorised",
      unitName: p.unit?.name ?? null,
      isSerialised: p.isSerialised,
      onHand, safetyStock: p.safetyStock,
      lastCost, stockValue,
      lowStock: p.safetyStock > 0 && onHand <= p.safetyStock,
      lastCostDisplay: formatBDT(lastCost),
      stockValueDisplay: formatBDT(stockValue),
    };
  });

  // Group by category name.
  const categoryMap = new Map<string, typeof productRows>();
  for (const row of productRows) {
    const cat = row.categoryName;
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(row);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([name, prods]) => {
      const totalQty = prods.reduce((s, p) => s + p.onHand, 0);
      const stockValue = prods.reduce((s, p) => s + p.stockValue, 0);
      return {
        name,
        productCount: prods.length,
        totalQty,
        stockValue,
        totalQtyDisplay: String(totalQty),
        stockValueDisplay: formatBDT(stockValue),
        products: prods,
      };
    })
    .sort((a, b) => b.stockValue - a.stockValue);

  const totals = {
    categoryCount: categories.length,
    productCount: productRows.length,
    totalQty: productRows.reduce((s, p) => s + p.onHand, 0),
    totalValue: productRows.reduce((s, p) => s + p.stockValue, 0),
  };

  return NextResponse.json({
    categories,
    totals,
  });
});
