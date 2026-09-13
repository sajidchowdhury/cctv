/**
 * GET /api/invoices/open — returns unpaid sales (customer) or purchases (supplier)
 * for settlement (doc §4.5 "Against Invoices: Ref[] — auto-allocate FIFO or manual").
 *
 * Query: ?type=customer|supplier&partyId=ID
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "customer";
  const partyId = url.searchParams.get("partyId") ?? "";

  if (type === "customer") {
    const sales = await db.sale.findMany({
      where: {
        deletedAt: null,
        isHeld: false,
        due: { gt: 0 },
        ...(partyId ? { customerId: partyId } : {}),
      },
      orderBy: { date: "asc" }, // FIFO = oldest first
      select: { id: true, invoiceNo: true, date: true, total: true, paid: true, due: true, customerId: true },
    });
    return NextResponse.json({
      invoices: sales.map((s) => ({
        id: s.id, ref: s.invoiceNo, date: s.date,
        total: s.total, paid: s.paid, due: s.due, partyId: s.customerId,
      })),
    });
  } else {
    const purchases = await db.purchase.findMany({
      where: {
        deletedAt: null,
        due: { gt: 0 },
        ...(partyId ? { supplierId: partyId } : {}),
      },
      orderBy: { date: "asc" },
      select: { id: true, invoiceNo: true, date: true, total: true, paid: true, due: true, supplierId: true },
    });
    return NextResponse.json({
      invoices: purchases.map((p) => ({
        id: p.id, ref: p.invoiceNo, date: p.date,
        total: p.total, paid: p.paid, due: p.due, partyId: p.supplierId,
      })),
    });
  }
});
