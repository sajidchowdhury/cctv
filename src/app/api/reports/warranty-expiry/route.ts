/**
 * GET /api/reports/warranty-expiry — upcoming warranty ends by date window (doc §5.3).
 *
 * Returns SOLD inventory units with warrantyEnd within the date range,
 * sorted by warrantyEnd ascending (soonest-expiring first).
 * Default window: next 90 days.
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, period, count }
 *
 * Search: serialNo (on inventoryUnit), productName, customerName.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const daysAhead = parseInt(url.searchParams.get("days") ?? "90", 10);
  const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with date range + search across serialNo, productName, customerName.
  const where = {
    deletedAt: null,
    status: "SOLD",
    warrantyEnd: {
      gte: new Date(from + "T00:00:00"),
      lte: new Date(to + "T23:59:59"),
    },
    ...(q
      ? {
          OR: [
            { serialNo: { contains: q } },
            { product: { name: { contains: q } } },
            { saleItem: { sale: { customer: { name: { contains: q } } } } },
          ],
        }
      : {}),
  };

  // Fetch ALL matching units for the total count.
  const total = await db.inventoryUnit.count({ where });

  // Fetch the PAGE's units with full includes.
  const units = await db.inventoryUnit.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, model: true, sku: true } },
      saleItem: {
        include: {
          sale: {
            include: { customer: { select: { id: true, name: true, phone: true } } },
          },
        },
      },
    },
    orderBy: { warrantyEnd: "asc" },
    skip,
    take,
  });

  const now = new Date();
  const rows = units.map((u) => ({
    id: u.id,
    serialNo: u.serialNo,
    productName: u.product.name,
    productModel: u.product.model,
    productSku: u.product.sku,
    warrantyEnd: u.warrantyEnd?.toISOString() ?? null,
    daysLeft: u.warrantyEnd ? Math.ceil((new Date(u.warrantyEnd).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null,
    expired: u.warrantyEnd ? new Date(u.warrantyEnd) < now : false,
    customerName: u.saleItem?.sale?.customer?.name ?? "Walk-in",
    customerPhone: u.saleItem?.sale?.customer?.phone ?? null,
    saleInvoice: u.saleItem?.sale?.invoiceNo ?? null,
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    period: { from, to },
    count: total,
  });
});
