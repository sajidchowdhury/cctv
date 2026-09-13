/**
 * GET /api/reports/purchase-detailed — invoice-wise line items (F4-S2).
 *
 * Query params: ?from=YYYY-MM-DD ?to=YYYY-MM-DD (default current month).
 *
 * Flat one-row-per-PurchaseItem list. Each row: invoiceNo, date, supplier,
 * product, model, qty, unitPrice, salesPrice, warrantyMonths, lineTotal, serials
 * (comma-joined string of serial numbers for that line).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";

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
      items: {
        include: {
          product: { select: { name: true, sku: true, model: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  const rows: any[] = [];
  for (const p of purchases) {
    for (const item of p.items) {
      const serialsArr: string[] = (() => {
        try { return JSON.parse(item.serials) as string[]; } catch { return []; }
      })();
      rows.push({
        invoiceNo: p.invoiceNo,
        date: p.date.toISOString(),
        dateDisplay: formatDate(p.date),
        supplierName: p.supplier?.name ?? "Walk-in",
        productName: item.product?.name ?? "—",
        productSku: item.product?.sku ?? null,
        productModel: item.product?.model ?? null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        salesPrice: item.salesPrice,
        warrantyMonths: item.warrantyMonths,
        lineTotal: item.lineTotal,
        serials: serialsArr,
        serialsDisplay: serialsArr.join(", ") || "—",
        serialCount: serialsArr.length,
        mode: p.mode,
        qtyDisplay: String(item.qty),
        unitPriceDisplay: formatBDT(item.unitPrice),
        salesPriceDisplay: item.salesPrice ? formatBDT(item.salesPrice) : "—",
        lineTotalDisplay: formatBDT(item.lineTotal),
      });
    }
  }

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalPurchase = rows.reduce((s, r) => s + r.lineTotal, 0);
  const totalSerials = rows.reduce((s, r) => s + r.serialCount, 0);

  return NextResponse.json({
    period: { from, to },
    summary: {
      invoiceCount: purchases.length,
      lineItemCount: rows.length,
      totalQty,
      totalPurchase,
      totalSerials,
      totalPurchaseDisplay: formatBDT(totalPurchase),
    },
    rows,
  });
});
