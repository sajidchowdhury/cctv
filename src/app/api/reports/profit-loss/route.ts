/**
 * GET /api/reports/profit-loss — profit/loss report (doc §5.3).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Per-invoice profit. Summary (totals) is computed across ALL matching sales
 * (not just the page). Rows are paginated via Prisma skip/take on Sale.
 *
 * Computes profit from each sale item (unitPrice - product lastCost) × qty.
 * Search: invoiceNo, customerName.
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

  // Build where clause with date range + search across invoiceNo, customerName.
  const where: Prisma.SaleWhereInput = {
    deletedAt: null, isHeld: false,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // ── Step 1: Fetch ALL matching sales (lightweight) for summary totals ────
  // Include only the fields needed to compute revenue, cost, discount per invoice.
  const allSales = await db.sale.findMany({
    where,
    select: {
      id: true,
      total: true,
      discount: true,
      items: {
        select: {
          qty: true,
          lineType: true,
          product: {
            select: {
              purchaseItems: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { unitPrice: true },
              },
            },
          },
        },
      },
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalDiscount = 0;

  for (const s of allSales) {
    const invoiceRevenue = s.total + s.discount; // pre-discount
    let invoiceCost = 0;
    for (const item of s.items) {
      if (item.lineType === "PRODUCT" && item.product) {
        const cost = item.product.purchaseItems[0]?.unitPrice ?? 0;
        invoiceCost += cost * item.qty;
      }
    }
    totalRevenue += invoiceRevenue;
    totalCost += invoiceCost;
    totalDiscount += s.discount;
  }

  const totalProfit = totalRevenue - totalCost - totalDiscount;
  const total = allSales.length;

  // ── Step 2: Fetch the PAGE's sales with full includes ──────────────────
  const sales = await db.sale.findMany({
    where,
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
    skip,
    take,
  });

  const rows = sales.map((s) => {
    const invoiceRevenue = s.total + s.discount; // pre-discount
    let invoiceCost = 0;
    for (const item of s.items) {
      if (item.lineType === "PRODUCT" && item.product) {
        const cost = item.product.purchaseItems[0]?.unitPrice ?? 0;
        invoiceCost += cost * item.qty;
      }
    }
    const grossProfit = invoiceRevenue - invoiceCost - s.discount;
    return {
      id: s.id, invoiceNo: s.invoiceNo, date: s.date.toISOString(),
      customerName: s.customer?.name ?? "Walk-in",
      revenue: invoiceRevenue, cost: invoiceCost, discount: s.discount,
      profit: grossProfit,
      margin: invoiceRevenue > 0 ? (grossProfit / invoiceRevenue) * 100 : 0,
    };
  });

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      count: total,
      totalRevenue, totalCost, totalDiscount, totalProfit,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalCostDisplay: formatBDT(totalCost),
      totalProfitDisplay: formatBDT(totalProfit),
      margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
  });
});
