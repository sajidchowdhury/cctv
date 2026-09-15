/**
 * GET /api/reports/purchase — purchase report with date range + totals (doc §5.3).
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Summary (totals) is computed across ALL matching purchases (not just the page)
 * so the summary stays accurate regardless of which page the user is viewing.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + search.
  const where = {
    deletedAt: null,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q } },
            { supplier: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Fetch ALL matching purchases for summary totals (lightweight select — no items).
  const allPurchases = await db.purchase.findMany({
    where,
    select: { id: true, total: true, paid: true, due: true },
  });

  const totalPurchase = allPurchases.reduce((s, x) => s + x.total, 0);
  const totalPaid = allPurchases.reduce((s, x) => s + x.paid, 0);
  const totalDue = allPurchases.reduce((s, x) => s + x.due, 0);
  const total = allPurchases.length;

  // Fetch the PAGE's purchases with full includes (supplier, items).
  const purchases = await db.purchase.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      items: { select: { lineTotal: true } },
    },
    orderBy: { date: "desc" },
    skip,
    take,
  });

  const rows = purchases.map((p) => ({
    id: p.id, invoiceNo: p.invoiceNo, date: p.date.toISOString(),
    supplierName: p.supplier?.name ?? "Walk-in",
    total: p.total, paid: p.paid, due: p.due, mode: p.mode,
    itemCount: p.items.length,
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      count: total,
      totalPurchase, totalPaid, totalDue,
      totalPurchaseDisplay: formatBDT(totalPurchase),
      totalPaidDisplay: formatBDT(totalPaid),
      totalDueDisplay: formatBDT(totalDue),
    },
  });
});
