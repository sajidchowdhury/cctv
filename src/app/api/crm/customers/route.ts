/**
 * GET /api/crm/customers — customer cards with CRM data (doc §5.4).
 *
 * Returns: name, phone, last purchase date, total spent, warranty status,
 * last follow-up date. Supports call-list filter (not contacted in N days).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "0", 10);
  const search = url.searchParams.get("q") ?? "";

  // Fetch all customers with their sales + follow-ups.
  const customers = await db.customer.findMany({
    where: {
      deletedAt: null,
      ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {}),
    },
    include: {
      sales: {
        where: { deletedAt: null, isHeld: false },
        orderBy: { date: "desc" },
        take: 1,
        select: { id: true, date: true, total: true },
      },
      followUps: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true, rating: true, nextDueDate: true },
      },
      _count: { select: { sales: true } },
    },
    orderBy: { name: "asc" },
  });

  // Compute total spent per customer.
  const customerIds = customers.map((c) => c.id);
  const totals = await db.sale.groupBy({
    by: ["customerId"],
    where: { deletedAt: null, isHeld: false, customerId: { in: customerIds } },
    _sum: { total: true },
  });
  const totalMap = new Map(totals.map((t) => [t.customerId, t._sum.total ?? 0]));

  const now = new Date();
  const cutoff = days > 0 ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  let cards = customers.map((c) => {
    const lastSale = c.sales[0];
    const lastFollowUp = c.followUps[0];
    const lastContactedAt = lastFollowUp?.createdAt ?? lastSale?.date ?? c.createdAt;
    const totalSpent = totalMap.get(c.id) ?? 0;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type,
      currentBalance: c.currentBalance,
      lastPurchaseDate: lastSale?.date.toISOString() ?? null,
      totalSpent,
      purchaseCount: c._count.sales,
      lastFollowUpDate: lastFollowUp?.createdAt.toISOString() ?? null,
      lastRating: lastFollowUp?.rating ?? null,
      nextDueDate: lastFollowUp?.nextDueDate?.toISOString() ?? null,
      lastContactedAt: lastContactedAt.toISOString(),
      daysSinceContact: Math.floor((now.getTime() - lastContactedAt.getTime()) / (24 * 60 * 60 * 1000)),
    };
  });

  // Call-list filter: customers not contacted in N days.
  if (cutoff) {
    cards = cards.filter((c) => new Date(c.lastContactedAt) < cutoff);
  }

  return NextResponse.json({ customers: cards, count: cards.length });
});
