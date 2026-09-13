/**
 * GET /api/reports/sales — sales report with date range + totals (doc §5.3).
 * Returns: invoice list (date, customer, total, paid, due, mode, salesman)
 * + summary (totalSales, totalPaid, totalDue, totalDiscount, count).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const sales = await db.sale.findMany({
    where: {
      deletedAt: null, isHeld: false,
      date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    },
    include: {
      customer: { select: { name: true } },
      salesman: { select: { name: true } },
      items: { select: { lineTotal: true } },
    },
    orderBy: { date: "desc" },
  });

  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const totalPaid = sales.reduce((s, x) => s + x.paid, 0);
  const totalDue = sales.reduce((s, x) => s + x.due, 0);
  const totalDiscount = sales.reduce((s, x) => s + x.discount, 0);

  return NextResponse.json({
    period: { from, to },
    summary: {
      count: sales.length,
      totalSales, totalPaid, totalDue, totalDiscount,
      totalSalesDisplay: formatBDT(totalSales),
      totalPaidDisplay: formatBDT(totalPaid),
      totalDueDisplay: formatBDT(totalDue),
    },
    sales: sales.map((s) => ({
      id: s.id, invoiceNo: s.invoiceNo, date: s.date.toISOString(),
      customerName: s.customer?.name ?? "Walk-in",
      salesman: s.salesman?.name ?? "—",
      total: s.total, paid: s.paid, due: s.due, discount: s.discount, mode: s.mode,
      itemCount: s.items.length,
    })),
  });
});
