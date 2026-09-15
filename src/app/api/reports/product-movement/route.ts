/**
 * GET /api/reports/product-movement — all IN/OUT movements per product with running
 * stock balance (F4-S1).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, products, summary }
 *
 * Paginate the movements array in-memory (after merging + running-balance
 * computation). Summary (per-product + overall totals) is computed across the
 * FULL set (accurate regardless of search). Search filters movements by productName.
 *
 * Query params:
 *   ?productId=<id>   (optional) — filter to one product; if omitted, aggregates all
 *   ?from=YYYY-MM-DD   (optional, defaults to today)
 *   ?to=YYYY-MM-DD     (optional, defaults to from)
 *
 * Stock movement sources:
 *   - PurchaseItem (IN): qty in, ref=purchase.invoiceNo, party=supplier.name
 *   - SaleItem where lineType=PRODUCT (OUT): qty out, ref=sale.invoiceNo, party=customer.name
 *
 * Note: InventoryUnit status changes (RMA, scrapped) are NOT tracked as movement
 * events here — there's no event log table. Only purchases + sales feed this report.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";
import { computeOnHandAt } from "@/lib/onhand";
import { parsePagination, paginateArray } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") ?? undefined;
  const fromStr = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const toStr = url.searchParams.get("to") ?? fromStr;
  const { page, pageSize, q } = parsePagination(req);

  const fromDate = new Date(fromStr + "T00:00:00");
  const toDate = new Date(toStr + "T23:59:59");

  // Load products (one or all).
  const products = await db.product.findMany({
    where: { deletedAt: null, ...(productId ? { id: productId } : {}) },
    select: {
      id: true, name: true, sku: true, model: true, isSerialised: true,
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  if (products.length === 0) {
    return NextResponse.json({
      ...paginateArray([], page, pageSize),
      products: [],
      summary: { totalIn: 0, totalOut: 0, productCount: 0 },
    });
  }

  const productIds = products.map((p) => p.id);

  // PurchaseItems in range (IN).
  const purchaseItems = await db.purchaseItem.findMany({
    where: {
      tenantId: user.tenantId!,
      productId: { in: productIds },
      purchase: { deletedAt: null, date: { gte: fromDate, lte: toDate } },
    },
    select: {
      id: true, productId: true, qty: true, unitPrice: true, lineTotal: true,
      purchase: { select: { invoiceNo: true, date: true, supplier: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // SaleItems (PRODUCT only) in range (OUT).
  const saleItems = await db.saleItem.findMany({
    where: {
      tenantId: user.tenantId!,
      productId: { in: productIds },
      lineType: "PRODUCT",
      sale: { deletedAt: null, date: { gte: fromDate, lte: toDate } },
    },
    select: {
      id: true, productId: true, qty: true, unitPrice: true, lineTotal: true,
      sale: { select: { invoiceNo: true, date: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build unified movement list.
  type Movement = {
    date: Date;
    type: "PURCHASE" | "SALE";
    ref: string;
    partyName: string;
    direction: "in" | "out";
    qty: number;
    unitPrice: number;
    lineTotal: number;
    productId: string;
    productName: string;
    balance: number;
  };

  // Pre-compute opening stock per product (everything before `from`).
  const openingStockMap = new Map<string, number>();
  for (const p of products) {
    const opening = await computeOnHandAt(db, user.tenantId!, p.id, p.isSerialised, fromDate);
    openingStockMap.set(p.id, opening);
  }

  // Build raw movements.
  const rawMovements: Omit<Movement, "balance">[] = [
    ...purchaseItems.map((pi) => ({
      date: pi.purchase.date,
      type: "PURCHASE" as const,
      ref: pi.purchase.invoiceNo,
      partyName: pi.purchase.supplier?.name ?? "—",
      direction: "in" as const,
      qty: pi.qty,
      unitPrice: pi.unitPrice,
      lineTotal: pi.lineTotal,
      productId: pi.productId,
      productName: products.find((p) => p.id === pi.productId)?.name ?? "—",
    })),
    ...saleItems.map((si) => ({
      date: si.sale.date,
      type: "SALE" as const,
      ref: si.sale.invoiceNo,
      partyName: si.sale.customer?.name ?? "Walk-in",
      direction: "out" as const,
      qty: si.qty,
      unitPrice: si.unitPrice,
      lineTotal: si.lineTotal,
      productId: si.productId!,
      productName: products.find((p) => p.id === si.productId)?.name ?? "—",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Compute running balance per product on the FULL set.
  const runningStock = new Map<string, number>(openingStockMap);
  const movements: Movement[] = rawMovements.map((m) => {
    const current = runningStock.get(m.productId) ?? 0;
    const newBalance = m.direction === "in" ? current + m.qty : current - m.qty;
    runningStock.set(m.productId, newBalance);
    return { ...m, balance: newBalance };
  });

  // Summary per product (computed from the FULL movement set).
  const productSummaries = products.map((p) => {
    const opening = openingStockMap.get(p.id) ?? 0;
    const inMoves = movements.filter((m) => m.productId === p.id && m.direction === "in");
    const outMoves = movements.filter((m) => m.productId === p.id && m.direction === "out");
    const totalIn = inMoves.reduce((s, m) => s + m.qty, 0);
    const totalOut = outMoves.reduce((s, m) => s + m.qty, 0);
    const closing = opening + totalIn - totalOut;
    return {
      id: p.id, name: p.name, sku: p.sku, model: p.model,
      categoryName: p.category?.name ?? null,
      isSerialised: p.isSerialised,
      openingStock: opening,
      totalIn,
      totalOut,
      closingStock: closing,
      movementCount: inMoves.length + outMoves.length,
    };
  });

  // Overall summary (from FULL movement set — accurate regardless of search).
  const totalIn = movements.reduce((s, m) => (m.direction === "in" ? s + m.qty : s), 0);
  const totalOut = movements.reduce((s, m) => (m.direction === "out" ? s + m.qty : s), 0);

  // Apply search filter (in-memory) BEFORE paginating.
  const qLower = q.toLowerCase();
  const filtered = q
    ? movements.filter((m) => m.productName.toLowerCase().includes(qLower))
    : movements;

  // Paginate the (filtered) movements.
  const pageResult = paginateArray(
    filtered.map((m) => ({
      ...m,
      date: m.date.toISOString(),
      qtyDisplay: String(m.qty),
      unitPriceDisplay: formatBDT(m.unitPrice),
      lineTotalDisplay: formatBDT(m.lineTotal),
      balanceDisplay: String(m.balance),
    })),
    page,
    pageSize
  );

  return NextResponse.json({
    ...pageResult,
    products: productSummaries,
    summary: {
      productCount: products.length,
      movementCount: movements.length,
      totalIn,
      totalOut,
      totalInDisplay: String(totalIn),
      totalOutDisplay: String(totalOut),
    },
  });
});
