/**
 * GET /api/reports/profit-loss-detailed — per-item cost breakdown + margin (F4-S2).
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, summary }
 *
 * Paginate the parent (Sale) — flatten only the page's items into per-SaleItem rows.
 * Summary is computed across ALL matching sales (not just the page).
 *
 * Each row: invoiceNo, date, customer, productName, serialNo, qty, unitPrice, discount,
 *   lineRevenue (qty × unitPrice × (1 - discount/100)), costPerUnit (last purchase
 *   price for the product), lineCost (qty × costPerUnit), lineProfit, margin%.
 *
 * Cost basis: last purchase price (matches existing profit-loss report). For
 * SERVICE lines, costPerUnit = 0, lineCost = 0, lineProfit = lineRevenue.
 * Search: invoiceNo, customerName, productName.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + search across invoiceNo, customerName, productName.
  const where: Prisma.SaleWhereInput = {
    deletedAt: null,
    isHeld: false,
    date: { gte: new Date(from + "T00:00:00"), lte: new Date(to + "T23:59:59") },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { items: { some: { product: { name: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  // ── Step 1: Fetch ALL matching sales (lightweight) for summary totals ────
  // Include only the fields needed to compute revenue, cost, margin per line item.
  const allSales = await db.sale.findMany({
    where,
    select: {
      id: true,
      items: {
        select: {
          qty: true,
          unitPrice: true,
          discount: true,
          lineType: true,
          product: {
            select: {
              id: true,
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

  // Pre-load latest purchase price per product (deduped for efficiency).
  const productCostMap = new Map<string, number>();
  for (const s of allSales) {
    for (const item of s.items) {
      if (item.product && !productCostMap.has(item.product.id)) {
        productCostMap.set(item.product.id, item.product.purchaseItems[0]?.unitPrice ?? 0);
      }
    }
  }

  let totalRevenue = 0;
  let totalCost = 0;
  let lineItemCount = 0;

  for (const s of allSales) {
    for (const item of s.items) {
      const isProduct = item.lineType === "PRODUCT" && item.product;
      const costPerUnit = isProduct ? (productCostMap.get(item.product!.id) ?? 0) : 0;
      const lineRevenue = item.qty * item.unitPrice * (1 - item.discount / 100);
      const lineCost = item.qty * costPerUnit;
      totalRevenue += lineRevenue;
      totalCost += lineCost;
      lineItemCount++;
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const total = allSales.length;

  // ── Step 2: Fetch the PAGE's sales with full includes ──────────────────
  const sales = await db.sale.findMany({
    where,
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
    skip,
    take,
  });

  // Flatten: one row per SaleItem (only for the page's sales).
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

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    summary: {
      invoiceCount: total,
      lineItemCount,
      totalRevenue,
      totalCost,
      totalProfit,
      margin: totalMargin,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalCostDisplay: formatBDT(totalCost),
      totalProfitDisplay: formatBDT(totalProfit),
      marginDisplay: `${totalMargin.toFixed(1)}%`,
    },
  });
});
