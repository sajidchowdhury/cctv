/**
 * GET /api/reports/stock-summary — product-wise on-hand qty, stock value, low-stock
 * flag (doc §5.3 Stock Summary report preview; full report in S18).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, totals }
 *
 * Stock value = on-hand × last purchase price (from the latest PurchaseItem
 * for each product). Products with no purchases yet have value 0.
 *
 * F1-S2: onHand branches on product.isSerialised.
 *   - Serialised: onHand = count of IN_STOCK InventoryUnit rows.
 *   - Non-serialised: onHand = ΣPurchaseItem.qty − ΣSaleItem.qty.
 *
 * Totals (totalUnits, totalValue, lowStockCount) are computed across ALL
 * matching products (not just the current page) so the summary stays accurate
 * regardless of which page the user is viewing.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";
import { parsePagination, paginateResponse } from "@/lib/pagination";
import { Prisma } from "@prisma/client";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const lowStockOnly = url.searchParams.get("lowStock") === "1";
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build search filter — search across name, sku, model.
  const searchWhere: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // ── Step 1: Fetch ALL matching products (minimal fields) for totals ──────
  // We need onHand for all products to compute accurate totals. The select here
  // is lightweight (no purchaseItems relation) — the expensive N+1 is avoided.
  const allProducts = await db.product.findMany({
    where: { deletedAt: null, ...searchWhere },
    select: {
      id: true,
      name: true,
      sku: true,
      isSerialised: true,
      safetyStock: true,
    },
    orderBy: { name: "asc" },
  });

  // ── Step 2: Compute onHand for ALL products (batched — 3 queries total) ──
  const onHandMap = await computeOnHandBatch(
    db,
    user.tenantId!,
    allProducts.map((p) => ({ id: p.id, isSerialised: p.isSerialised }))
  );

  // Build full rows in memory (needed for totals + lowStock filtering).
  let allRows = allProducts.map((p) => {
    const onHand = onHandMap.get(p.id) ?? 0;
    const lowStock = p.safetyStock > 0 && onHand <= p.safetyStock;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      isSerialised: p.isSerialised,
      safetyStock: p.safetyStock,
      onHand,
      lowStock,
      deficit: lowStock ? p.safetyStock - onHand : 0,
    };
  });

  // Apply low-stock filter if requested.
  if (lowStockOnly) {
    allRows = allRows.filter((r) => r.lowStock);
  }

  // ── Step 3: Compute totals from the FULL set (accurate, not page-scoped) ──
  const totalUnits = allRows.reduce((s, r) => s + r.onHand, 0);
  const lowStockCount = allRows.filter((r) => r.lowStock).length;

  // ── Step 4: Paginate the array for the response ──────────────────────────
  const total = allRows.length;
  const pageRows = allRows.slice(skip, skip + take);

  // ── Step 5: Fetch full details (model, category, unit, lastCost) ONLY for
  // the page's products — avoids loading purchaseItems for all 1000+ products.
  const pageProductIds = pageRows.map((r) => r.id);
  const pageDetails = pageProductIds.length > 0
    ? await db.product.findMany({
        where: { id: { in: pageProductIds } },
        select: {
          id: true,
          model: true,
          category: { select: { name: true } },
          unit: { select: { name: true } },
          purchaseItems: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { unitPrice: true },
          },
        },
      })
    : [];
  const detailMap = new Map(pageDetails.map((p) => [p.id, p]));

  // Merge page rows with full details.
  const rows = pageRows.map((r) => {
    const d = detailMap.get(r.id);
    const lastCost = d?.purchaseItems[0]?.unitPrice ?? 0;
    return {
      ...r,
      model: d?.model ?? null,
      categoryName: d?.category?.name ?? null,
      unitName: d?.unit?.name ?? null,
      lastCost,
      stockValue: r.onHand * lastCost,
    };
  });

  const totalValue = rows.reduce((s, r) => s + r.stockValue, 0);

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    totals: {
      productCount: total,
      totalUnits,
      totalValue,
      lowStockCount,
    },
  });
});
