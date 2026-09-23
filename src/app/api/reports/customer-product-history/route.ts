/**
 * GET /api/reports/customer-product-history
 *
 * Phase 5 / Feature #8: Returns the date-wise sale history of a specific
 * product to a specific customer within an optional date range.
 *
 * Use case: "How many times did Customer X buy Product A, at what price,
 * and what quantity?"
 *
 * Query params:
 *   customerId (required) — filter sales to this customer
 *   productId  (required) — filter sale items to this product
 *   from       (optional) — ISO date string (YYYY-MM-DD), defaults to 1 year ago
 *   to         (optional) — ISO date string (YYYY-MM-DD), defaults to today
 *
 * Response:
 *   {
 *     customer: { id, name, phone } | null,
 *     product: { id, name, model, sku } | null,
 *     period: { from, to },
 *     sales: [
 *       {
 *         saleId, invoiceNo, date,
 *         qty, unitPrice, lineTotal,
 *         salesmanName
 *       },
 *       ...
 *     ],
 *     summary: {
 *       saleCount,
 *       totalQty,
 *       totalAmount,
 *       firstSaleDate,
 *       lastSaleDate,
 *       avgUnitPrice,
 *       minUnitPrice,
 *       maxUnitPrice,
 *     }
 *   }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? "";
  const productId = url.searchParams.get("productId") ?? "";
  // Default date range: 1 year ago → today.
  const defaultFrom = new Date();
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);
  const from = url.searchParams.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  // Validate required params.
  if (!customerId || !productId) {
    return NextResponse.json(
      { error: "Both customerId and productId are required." },
      { status: 422 }
    );
  }

  // Fetch customer + product info in parallel with the sale items.
  const [customer, product, saleItems] = await Promise.all([
    db.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId!, deletedAt: null },
      select: { id: true, name: true, phone: true },
    }),
    db.product.findFirst({
      where: { id: productId, tenantId: user.tenantId!, deletedAt: null },
      select: { id: true, name: true, model: true, sku: true },
    }),
    db.saleItem.findMany({
      where: {
        tenantId: user.tenantId!,
        productId,
        // Only include items from non-held, non-deleted sales within the date
        // range, for the selected customer.
        sale: {
          deletedAt: null,
          isHeld: false,
          customerId,
          date: {
            gte: new Date(from + "T00:00:00"),
            lte: new Date(to + "T23:59:59"),
          },
        },
      },
      include: {
        sale: {
          select: {
            id: true,
            invoiceNo: true,
            date: true,
            salesman: { select: { name: true } },
          },
        },
      },
      orderBy: { sale: { date: "desc" } },
    }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  // Build the sales array.
  const sales = saleItems.map((it) => ({
    saleId: it.sale.id,
    invoiceNo: it.sale.invoiceNo,
    date: it.sale.date,
    qty: it.qty,
    unitPrice: it.unitPrice,
    lineTotal: it.lineTotal,
    salesmanName: it.sale.salesman?.name ?? null,
  }));

  // Compute summary statistics.
  const saleCount = sales.length;
  const totalQty = sales.reduce((s, x) => s + x.qty, 0);
  const totalAmount = sales.reduce((s, x) => s + x.lineTotal, 0);
  const dates = sales.map((s) => new Date(s.date).getTime());
  const prices = sales.map((s) => s.unitPrice);
  const firstSaleDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const lastSaleDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
  const avgUnitPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const minUnitPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxUnitPrice = prices.length > 0 ? Math.max(...prices) : 0;

  return NextResponse.json({
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    product: { id: product.id, name: product.name, model: product.model, sku: product.sku },
    period: { from, to },
    sales,
    summary: {
      saleCount,
      totalQty,
      totalAmount,
      firstSaleDate: firstSaleDate?.toISOString() ?? null,
      lastSaleDate: lastSaleDate?.toISOString() ?? null,
      avgUnitPrice: Math.round(avgUnitPrice * 100) / 100,
      minUnitPrice,
      maxUnitPrice,
    },
  });
});
