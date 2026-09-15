/**
 * GET /api/reports/purchase-detailed — invoice-wise line items (F4-S2).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Paginate the parent (Purchase) — flatten only the page's items into per-PurchaseItem rows.
 * Summary is computed across ALL matching purchases (not just the page).
 *
 * Query params: ?from=YYYY-MM-DD ?to=YYYY-MM-DD (default current month).
 *
 * Each row: invoiceNo, date, supplier, product, model, qty, unitPrice, salesPrice,
 * warrantyMonths, lineTotal, serials (comma-joined string of serial numbers for that line).
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + search across invoiceNo, supplierName, productName.
  const where: Prisma.PurchaseWhereInput = {
    deletedAt: null,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { supplier: { name: { contains: q, mode: "insensitive" } } },
            { items: { some: { product: { name: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  // ── Step 1: Fetch ALL matching purchases (lightweight) for summary totals ──
  // Include items with only the fields needed for summary (qty, lineTotal, serials).
  const allPurchases = await db.purchase.findMany({
    where,
    select: {
      id: true,
      items: { select: { qty: true, lineTotal: true, serials: true } },
    },
  });

  const total = allPurchases.length;
  const lineItemCount = allPurchases.reduce((s, x) => s + x.items.length, 0);
  const totalQty = allPurchases.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0);
  const totalPurchase = allPurchases.reduce((s, x) => s + x.items.reduce((a, i) => a + i.lineTotal, 0), 0);
  const totalSerials = allPurchases.reduce((s, x) => s + x.items.reduce((a, i) => {
    try { return a + (JSON.parse(i.serials) as string[]).length; } catch { return a; }
  }, 0), 0);

  // ── Step 2: Fetch the PAGE's purchases with full includes ─────────────
  const purchases = await db.purchase.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, model: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
    skip,
    take,
  });

  // Flatten: one row per PurchaseItem (only for the page's purchases).
  const rows: any[] = [];
  for (const p of purchases) {
    for (const item of p.items) {
      const serialsArr: string[] = (() => {
        try { return JSON.parse(item.serials) as string[]; } catch { return []; }
      })();
      rows.push({
        invoiceNo: p.invoiceNo,
        date: p.date.toISOString(),
        dateDisplay: formatDate(p.date),
        supplierName: p.supplier?.name ?? "Walk-in",
        productName: item.product?.name ?? "—",
        productSku: item.product?.sku ?? null,
        productModel: item.product?.model ?? null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        salesPrice: item.salesPrice,
        warrantyMonths: item.warrantyMonths,
        lineTotal: item.lineTotal,
        serials: serialsArr,
        serialsDisplay: serialsArr.join(", ") || "—",
        serialCount: serialsArr.length,
        mode: p.mode,
        qtyDisplay: String(item.qty),
        unitPriceDisplay: formatBDT(item.unitPrice),
        salesPriceDisplay: item.salesPrice ? formatBDT(item.salesPrice) : "—",
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
      totalPurchase,
      totalSerials,
      totalPurchaseDisplay: formatBDT(totalPurchase),
    },
  });
});
