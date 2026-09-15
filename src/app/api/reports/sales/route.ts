/**
 * GET /api/reports/sales — sales report with date range + totals (doc §5.3).
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Summary (totals) is computed across ALL matching sales (not just the page)
 * so the summary stays accurate regardless of which page the user is viewing.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  const where: Prisma.SaleWhereInput = {
    deletedAt: null,
    isHeld: false,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { salesman: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Fetch ALL matching sales for summary totals (lightweight select — no items).
  const allSales = await db.sale.findMany({
    where,
    select: { id: true, total: true, paid: true, due: true, discount: true },
  });

  const totalSales = allSales.reduce((s, x) => s + x.total, 0);
  const totalPaid = allSales.reduce((s, x) => s + x.paid, 0);
  const totalDue = allSales.reduce((s, x) => s + x.due, 0);
  const totalDiscount = allSales.reduce((s, x) => s + x.discount, 0);
  const total = allSales.length;

  // Fetch the PAGE's sales with full includes (customer, salesman, items).
  const sales = await db.sale.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      salesman: { select: { name: true } },
      items: { select: { lineTotal: true } },
    },
    orderBy: { date: "desc" },
    skip,
    take,
  });

  const rows = sales.map((s) => ({
    id: s.id, invoiceNo: s.invoiceNo, date: s.date.toISOString(),
    customerName: s.customer?.name ?? "Walk-in",
    salesman: s.salesman?.name ?? "—",
    total: s.total, paid: s.paid, due: s.due, discount: s.discount, mode: s.mode,
    itemCount: s.items.length,
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      count: total,
      totalSales, totalPaid, totalDue, totalDiscount,
      totalSalesDisplay: formatBDT(totalSales),
      totalPaidDisplay: formatBDT(totalPaid),
      totalDueDisplay: formatBDT(totalDue),
    },
  });
});
