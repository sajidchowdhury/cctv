/**
 * GET /api/reports/stock-by-model — stock grouped by Product.model field (F4-S2).
 *
 * Snapshot report. Groups ALL products by their `model` field (null → "No model").
 * For serialised products in each model group, optionally list their serial-level
 * InventoryUnit rows (drill-down). Non-serialised products show qty only.
 *
 * Query params:
 *   ?model=<model>   (optional) — drill-down to one model's serial-level breakdown
 *
 * Returns:
 *   {
 *     models: [{ name, productCount, totalQty, stockValue, products: [...] }],
 *     totals: { modelCount, productCount, totalQty, totalValue }
 *   }
 *
 * When ?model=X is set, also returns `serials: [{ serialNo, productName, status,
 * warrantyEnd, purchaseCost }]` for all InventoryUnits of products with that model.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";
import { formatBDT, formatDate } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const modelFilter = url.searchParams.get("model");

  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true, sku: true, model: true,
      isSerialised: true,
      category: { select: { name: true } },
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
      id: p.id, name: p.name, sku: p.sku, model: p.model ?? "No model",
      categoryName: p.category?.name ?? "Uncategorised",
      isSerialised: p.isSerialised,
      onHand, lastCost, stockValue,
      lastCostDisplay: formatBDT(lastCost),
      stockValueDisplay: formatBDT(stockValue),
    };
  });

  // Group by model.
  const modelMap = new Map<string, typeof productRows>();
  for (const row of productRows) {
    const m = row.model;
    if (!modelMap.has(m)) modelMap.set(m, []);
    modelMap.get(m)!.push(row);
  }

  const models = Array.from(modelMap.entries())
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
    modelCount: models.length,
    productCount: productRows.length,
    totalQty: productRows.reduce((s, p) => s + p.onHand, 0),
    totalValue: productRows.reduce((s, p) => s + p.stockValue, 0),
  };

  // Optional: drill-down to serial-level breakdown for a specific model.
  let serials: any[] | undefined;
  if (modelFilter) {
    const modelProducts = products.filter((p) => (p.model ?? "No model") === modelFilter && p.isSerialised);
    const modelProductIds = modelProducts.map((p) => p.id);
    if (modelProductIds.length > 0) {
      const units = await db.inventoryUnit.findMany({
        where: { deletedAt: null, productId: { in: modelProductIds } },
        select: {
          id: true, serialNo: true, status: true, warrantyEnd: true,
          productId: true,
          purchaseItem: { select: { unitPrice: true } },
        },
        orderBy: { serialNo: "asc" },
      });
      serials = units.map((u) => {
        const prod = modelProducts.find((p) => p.id === u.productId);
        return {
          id: u.id,
          serialNo: u.serialNo,
          productName: prod?.name ?? "—",
          status: u.status,
          warrantyEnd: u.warrantyEnd ? formatDate(u.warrantyEnd) : null,
          purchaseCost: u.purchaseItem?.unitPrice ?? 0,
          purchaseCostDisplay: u.purchaseItem?.unitPrice ? formatBDT(u.purchaseItem.unitPrice) : "—",
        };
      });
    } else {
      serials = [];
    }
  }

  return NextResponse.json({
    models,
    totals,
    ...(serials ? { serials, serialCount: serials.length, modelFilter } : {}),
  });
});
