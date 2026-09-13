/**
 * GET /api/crm/call-list?days=30|60|90 — customers not contacted in N days (doc §5.4).
 * Shorthand for /api/crm/customers?days=N.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);

  const customers = await db.customer.findMany({
    where: { deletedAt: null },
    include: {
      sales: { where: { deletedAt: null, isHeld: false }, orderBy: { date: "desc" }, take: 1, select: { date: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const callList = customers
    .map((c) => {
      const lastContact = c.followUps[0]?.createdAt ?? c.sales[0]?.date ?? c.createdAt;
      return {
        id: c.id, name: c.name, phone: c.phone,
        lastContactedAt: lastContact.toISOString(),
        daysSince: Math.floor((now.getTime() - lastContact.getTime()) / (24 * 60 * 60 * 1000)),
      };
    })
    .filter((c) => new Date(c.lastContactedAt) < cutoff)
    .sort((a, b) => b.daysSince - a.daysSince);

  return NextResponse.json({ callList, count: callList.length, days });
});
