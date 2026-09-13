/**
 * GET /api/reports/income-expense — account-head-wise monthly summary (doc §5.3).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const txns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: { in: ["IN", "EXP"] },
      date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    },
    include: { accountHead: { select: { id: true, name: true, kind: true } } },
    orderBy: { date: "desc" },
  });

  // Group by account head.
  const byHead: Record<string, { name: string; kind: string; total: number; count: number }> = {};
  for (const t of txns) {
    const key = t.accountHeadId ?? "uncategorized";
    const name = t.accountHead?.name ?? "Uncategorized";
    const kind = t.accountHead?.kind ?? (t.type === "IN" ? "IN" : "EXP");
    if (!byHead[key]) byHead[key] = { name, kind, total: 0, count: 0 };
    byHead[key].total += t.amount;
    byHead[key].count++;
  }

  const totalIncome = txns.filter((t) => t.type === "IN").reduce((s, t) => s + t.amount, 0);
  const totalExpense = txns.filter((t) => t.type === "EXP").reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    period: { from, to },
    summary: {
      totalIncome, totalExpense, net: totalIncome - totalExpense,
      totalIncomeDisplay: formatBDT(totalIncome),
      totalExpenseDisplay: formatBDT(totalExpense),
      netDisplay: formatBDT(totalIncome - totalExpense),
    },
    heads: Object.values(byHead).sort((a, b) => a.kind.localeCompare(b.kind) || b.total - a.total),
  });
});
