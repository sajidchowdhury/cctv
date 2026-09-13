/**
 * GET /api/reports/warranty-expiry — upcoming warranty ends by date window (doc §5.3).
 *
 * Returns SOLD inventory units with warrantyEnd within the date range,
 * sorted by warrantyEnd ascending (soonest-expiring first).
 * Default window: next 90 days.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const daysAhead = parseInt(url.searchParams.get("days") ?? "90", 10);
  const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const units = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      status: "SOLD",
      warrantyEnd: {
        gte: new Date(from + "T00:00:00"),
        lte: new Date(to + "T23:59:59"),
      },
    },
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
  });

  const now = new Date();
  return NextResponse.json({
    period: { from, to },
    count: units.length,
    units: units.map((u) => ({
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
    })),
  });
});
