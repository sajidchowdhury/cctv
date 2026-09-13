/**
 * GET /api/reports/profit-loss-detailed — per-item cost breakdown + margin (F4-S2).
 *
 * Query params: ?from=YYYY-MM-DD ?to=YYYY-MM-DD (default current month).
 *
 * Flat one-row-per-SaleItem list with cost breakdown. Each row:
 *   invoiceNo, date, customer, productName, serialNo, qty, unitPrice, discount,
 *   lineRevenue (qty × unitPrice × (1 - discount/100)), costPerUnit (last purchase
 *   price for the product), lineCost (qty × costPerUnit), lineProfit, margin%.
 *
 * Cost basis: last purchase price (matches existing profit-loss report). For
 * SERVICE lines, costPerUnit = 0, lineCost = 0, lineProfit = lineRevenue.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const sales = await db.sale.findMany({
    where: {
      deletedAt: null,
      isHeld: false,
      date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, model: true,
              purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, select: { unitPrice: true } },
            },
          },
          inventoryUnit: { select: { serialNo: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  // Pre-load latest purchase price per product (deduped for efficiency).
  const productCostMap = new Map<string, number>();
  for (const s of sales) {
    for (const item of s.items) {
      if (item.product && !productCostMap.has(item.product.id)) {
        productCostMap.set(item.product.id, item.product.purchaseItems[0]?.unitPrice ?? 0);
      }
    }
  }

  const rows: any[] = [];
  for (const s of sales) {
    for (const item of s.items) {
      const isProduct = item.lineType === "PRODUCT" && item.product;
      const costPerUnit = isProduct ? (productCostMap.get(item.product!.id) ?? 0) : 0;
      const lineRevenue = item.qty * item.unitPrice * (1 - item.discount / 100);
      const lineCost = item.qty * costPerUnit;
      const lineProfit = lineRevenue - lineCost;
      const margin = lineRevenue > 0 ? (lineProfit / lineRevenue) * 100 : 0;

      rows.push({
        invoiceNo: s.invoiceNo,
        date: s.date.toISOString(),
        dateDisplay: formatDate(s.date),
        customerName: s.customer?.name ?? "Walk-in",
        lineType: item.lineType,
        productName: isProduct ? item.product!.name : (item.description ?? "Service"),
        productSku: item.product?.sku ?? null,
        serialNo: item.inventoryUnit?.serialNo ?? null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount,
        costPerUnit,
        lineRevenue,
        lineCost,
        lineProfit,
        margin,
        qtyDisplay: String(item.qty),
        unitPriceDisplay: formatBDT(item.unitPrice),
        costPerUnitDisplay: formatBDT(costPerUnit),
        lineRevenueDisplay: formatBDT(lineRevenue),
        lineCostDisplay: formatBDT(lineCost),
        lineProfitDisplay: formatBDT(lineProfit),
        marginDisplay: `${margin.toFixed(1)}%`,
      });
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + r.lineRevenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.lineCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return NextResponse.json({
    period: { from, to },
    summary: {
      invoiceCount: sales.length,
      lineItemCount: rows.length,
      totalRevenue,
      totalCost,
      totalProfit,
      margin: totalMargin,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalCostDisplay: formatBDT(totalCost),
      totalProfitDisplay: formatBDT(totalProfit),
      marginDisplay: `${totalMargin.toFixed(1)}%`,
    },
    rows,
  });
});
