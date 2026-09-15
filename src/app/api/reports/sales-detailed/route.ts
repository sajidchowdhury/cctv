/**
 * GET /api/reports/sales-detailed — invoice-wise line items (F4-S2).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Paginate the parent (Sale) — flatten only the page's items into per-SaleItem rows.
 * Summary is computed across ALL matching sales (not just the page).
 *
 * Query params:
 *   ?from=YYYY-MM-DD   (default: 1st of current month)
 *   ?to=YYYY-MM-DD     (default: today)
 *
 * Each row: invoiceNo, date, customer, salesman, product, serialNo, qty, unitPrice,
 * discount, lineTotal, lineType, mode.
 *
 * Service lines are included (product = description, serialNo = null).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + search across invoiceNo, customerName, productName.
  const where = {
    deletedAt: null,
    isHeld: false,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q } },
            { customer: { name: { contains: q } } },
            { items: { some: { product: { name: { contains: q } } } } },
          ],
        }
      : {}),
  };

  // ── Step 1: Fetch ALL matching sales (lightweight) for summary totals ────
  // Include items with only the fields needed for summary (qty, lineTotal, discount).
  const allSales = await db.sale.findMany({
    where,
    select: {
      id: true,
      items: { select: { qty: true, lineTotal: true, discount: true } },
    },
  });

  const total = allSales.length;
  const lineItemCount = allSales.reduce((s, x) => s + x.items.length, 0);
  const totalQty = allSales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
  const totalRevenue = allSales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.lineTotal, 0), 0);
  const totalDiscount = allSales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.discount, 0), 0);

  // ── Step 2: Fetch the PAGE's sales with full includes ──────────────────
  const sales = await db.sale.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      salesman: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, model: true } },
          inventoryUnit: { select: { serialNo: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
    skip,
    take,
  });

  // Flatten: one row per SaleItem (only for the page's sales).
  const rows: any[] = [];
  for (const s of sales) {
    for (const item of s.items) {
      rows.push({
        invoiceNo: s.invoiceNo,
        date: s.date.toISOString(),
        dateDisplay: formatDate(s.date),
        customerName: s.customer?.name ?? "Walk-in",
        salesman: s.salesman?.name ?? "—",
        lineType: item.lineType,
        productName: item.lineType === "PRODUCT" ? item.product?.name ?? "—" : item.description ?? "Service",
        productSku: item.product?.sku ?? null,
        productModel: item.product?.model ?? null,
        serialNo: item.inventoryUnit?.serialNo ?? null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
        mode: s.mode,
        qtyDisplay: String(item.qty),
        unitPriceDisplay: formatBDT(item.unitPrice),
        lineTotalDisplay: formatBDT(item.lineTotal),
      });
    }
  }

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      invoiceCount: total,
      lineItemCount,
      totalQty,
      totalRevenue,
      totalDiscount,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalDiscountDisplay: formatBDT(totalDiscount),
    },
  });
});
