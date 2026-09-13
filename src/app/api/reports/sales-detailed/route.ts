/**
 * GET /api/reports/sales-detailed — invoice-wise line items (F4-S2).
 *
 * Query params:
 *   ?from=YYYY-MM-DD   (default: 1st of current month)
 *   ?to=YYYY-MM-DD     (default: today)
 *
 * Returns a FLAT one-row-per-SaleItem list (CSV-friendly) plus summary cards.
 * Each row: invoiceNo, date, customer, salesman, product, serialNo, qty, unitPrice,
 * discount, lineTotal, lineType, mode.
 *
 * Service lines are included (product = description, serialNo = null).
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
      salesman: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, model: true } },
          inventoryUnit: { select: { serialNo: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  // Flatten: one row per SaleItem.
  const rows: any[] = [];
  for (const s of sales) {
    for (const item of s.items) {
      rows.push({
        invoiceNo: s.invoiceNo,
        date: s.date.toISOString(),
        dateDisplay: formatDate(s.date),
        customerName: s.customer?.name ?? "Walk-in",
        salesman: s.salesman?.name ?? "—",
        lineType: item.lineType,
        productName: item.lineType === "PRODUCT" ? item.product?.name ?? "—" : item.description ?? "Service",
        productSku: item.product?.sku ?? null,
        productModel: item.product?.model ?? null,
        serialNo: item.inventoryUnit?.serialNo ?? null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
        mode: s.mode,
        qtyDisplay: String(item.qty),
        unitPriceDisplay: formatBDT(item.unitPrice),
        lineTotalDisplay: formatBDT(item.lineTotal),
      });
    }
  }

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.lineTotal, 0);
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0);

  return NextResponse.json({
    period: { from, to },
    summary: {
      invoiceCount: sales.length,
      lineItemCount: rows.length,
      totalQty,
      totalRevenue,
      totalDiscount,
      totalRevenueDisplay: formatBDT(totalRevenue),
      totalDiscountDisplay: formatBDT(totalDiscount),
    },
    rows,
  });
});
