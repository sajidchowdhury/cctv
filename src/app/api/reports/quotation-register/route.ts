/**
 * GET /api/reports/quotation-register — all quotes by status/customer/date
 * with win/loss + conversion rate (doc §5.3, §5.6).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const status = url.searchParams.get("status") ?? "";

  const quotes = await db.quotation.findMany({
    where: {
      deletedAt: null,
      date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
      ...(status ? { status } : {}),
    },
    include: {
      customer: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { date: "desc" },
  });

  const total = quotes.length;
  const converted = quotes.filter((q) => q.status === "CONVERTED").length;
  const accepted = quotes.filter((q) => q.status === "ACCEPTED").length;
  const rejected = quotes.filter((q) => q.status === "REJECTED").length;
  const sent = quotes.filter((q) => q.status === "SENT").length;
  const draft = quotes.filter((q) => q.status === "DRAFT").length;
  const totalValue = quotes.reduce((s, q) => s + q.total, 0);
  const convertedValue = quotes.filter((q) => q.status === "CONVERTED").reduce((s, q) => s + q.total, 0);

  return NextResponse.json({
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
    quotes: quotes.map((q) => ({
      id: q.id, quoteNo: q.quoteNo, date: q.date.toISOString(),
      customerName: q.customerName ?? q.customer?.name ?? "Walk-in prospect",
      projectType: q.projectType,
      total: q.total, status: q.status, itemCount: q.items.length,
      lossReason: q.lossReason,
    })),
  });
});
