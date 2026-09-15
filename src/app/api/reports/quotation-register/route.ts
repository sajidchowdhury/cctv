/**
 * GET /api/reports/quotation-register — all quotes by status/customer/date
 * with win/loss + conversion rate (doc §5.3, §5.6).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Summary (totals) is computed across ALL matching quotes (not just the page)
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
  const status = url.searchParams.get("status") ?? "";
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + status + search.
  const where = {
    deletedAt: null,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { quoteNo: { contains: q } },
            { customerName: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Fetch ALL matching quotes for summary totals (lightweight select).
  const allQuotes = await db.quotation.findMany({
    where,
    select: { id: true, total: true, status: true },
  });

  const total = allQuotes.length;
  const converted = allQuotes.filter((q) => q.status === "CONVERTED").length;
  const accepted = allQuotes.filter((q) => q.status === "ACCEPTED").length;
  const rejected = allQuotes.filter((q) => q.status === "REJECTED").length;
  const sent = allQuotes.filter((q) => q.status === "SENT").length;
  const draft = allQuotes.filter((q) => q.status === "DRAFT").length;
  const totalValue = allQuotes.reduce((s, q) => s + q.total, 0);
  const convertedValue = allQuotes.filter((q) => q.status === "CONVERTED").reduce((s, q) => s + q.total, 0);

  // Fetch the PAGE's quotes with full includes (customer, items).
  const quotes = await db.quotation.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { date: "desc" },
    skip,
    take,
  });

  const rows = quotes.map((q) => ({
    id: q.id, quoteNo: q.quoteNo, date: q.date.toISOString(),
    customerName: q.customerName ?? q.customer?.name ?? "Walk-in prospect",
    projectType: q.projectType,
    total: q.total, status: q.status, itemCount: q.items.length,
    lossReason: q.lossReason,
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      total, draft, sent, accepted, converted, rejected,
      conversionRate: total > 0 ? (converted / total) * 100 : 0,
      winRate: (accepted + converted) > 0 ? (converted / (accepted + converted)) * 100 : 0,
      totalValue, convertedValue,
      totalValueDisplay: formatBDT(totalValue),
      convertedValueDisplay: formatBDT(convertedValue),
      avgQuoteValue: total > 0 ? totalValue / total : 0,
    },
  });
});
