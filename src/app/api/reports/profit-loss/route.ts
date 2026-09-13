/**
 * GET /api/reports/profit-loss — profit/loss report (doc §5.3).
 *
 * Per invoice & aggregate: (sales − purchase − discount).
 * Computes profit from each sale item (unitPrice - product lastCost) × qty.
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
      items: {
        include: {
          product: {
            include: {
              purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, select: { unitPrice: true } },
            },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalDiscount = 0;

  const rows = sales.map((s) => {
    let invoiceRevenue = s.total + s.discount; // pre-discount
    let invoiceCost = 0;
    for (const item of s.items) {
      if (item.lineType === "PRODUCT" && item.product) {
        const cost = item.product.purchaseItems[0]?.unitPrice ?? 0;
        invoiceCost += cost * item.qty;
      }
    }
    const grossProfit = invoiceRevenue - invoiceCost - s.discount;
    totalRevenue += invoiceRevenue;
    totalCost += invoiceCost;
    totalDiscount += s.discount;
    return {
      id: s.id, invoiceNo: s.invoiceNo, date: s.date.toISOString(),
      customerName: s.customer?.name ?? "Walk-in",
      revenue: invoiceRevenue, cost: invoiceCost, discount: s.discount,
      profit: grossProfit,
      margin: invoiceRevenue > 0 ? (grossProfit / invoiceRevenue) * 100 : 0,
    };
  });

  const totalProfit = totalRevenue - totalCost - totalDiscount;

  return NextResponse.json({
    period: { from, to },
    summary: {
      count: sales.length,
      totalRevenue, totalCost, totalDiscount, totalProfit,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalCostDisplay: formatBDT(totalCost),
      totalProfitDisplay: formatBDT(totalProfit),
      margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
    rows,
  });
});
