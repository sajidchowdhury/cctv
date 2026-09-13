/**
 * GET /api/reports/purchase — purchase report with date range + totals (doc §5.3).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const purchases = await db.purchase.findMany({
    where: {
      deletedAt: null,
      date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    },
    include: {
      supplier: { select: { name: true } },
      items: { select: { lineTotal: true } },
    },
    orderBy: { date: "desc" },
  });

  const totalPurchase = purchases.reduce((s, x) => s + x.total, 0);
  const totalPaid = purchases.reduce((s, x) => s + x.paid, 0);
  const totalDue = purchases.reduce((s, x) => s + x.due, 0);

  return NextResponse.json({
    period: { from, to },
    summary: {
      count: purchases.length,
      totalPurchase, totalPaid, totalDue,
      totalPurchaseDisplay: formatBDT(totalPurchase),
      totalPaidDisplay: formatBDT(totalPaid),
      totalDueDisplay: formatBDT(totalDue),
    },
    purchases: purchases.map((p) => ({
      id: p.id, invoiceNo: p.invoiceNo, date: p.date.toISOString(),
      supplierName: p.supplier?.name ?? "Walk-in",
      total: p.total, paid: p.paid, due: p.due, mode: p.mode,
      itemCount: p.items.length,
    })),
  });
});
