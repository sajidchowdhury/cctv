/**
 * GET /api/crm/customers/[id]/timeline — purchase history + follow-ups (doc §5.4).
 *
 * Returns a unified timeline of sales + follow-up notes, sorted by date desc.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT, formatDate } from "@/lib/format";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        where: { deletedAt: null },
        orderBy: { date: "desc" },
        include: { items: { include: { product: { select: { name: true } } } } },
        take: 50,
      },
      followUps: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  // Build unified timeline.
  const timeline: any[] = [];

  for (const s of customer.sales) {
    timeline.push({
      type: "SALE",
      date: s.date.toISOString(),
      ref: s.invoiceNo,
      title: `Sale ${s.invoiceNo}`,
      amount: s.total,
      amountDisplay: formatBDT(s.total),
      items: s.items.map((it) => ({
        product: it.product?.name ?? it.description ?? "Service",
        qty: it.qty,
        price: it.unitPrice,
      })),
    });
  }

  for (const f of customer.followUps) {
    timeline.push({
      type: "FOLLOWUP",
      date: f.createdAt.toISOString(),
      ref: f.rating,
      title: `Follow-up: ${f.rating}`,
      note: f.note,
      author: f.author?.name ?? "—",
      nextDueDate: f.nextDueDate?.toISOString() ?? null,
    });
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    customer: {
      id: customer.id, name: customer.name, phone: customer.phone,
      address: customer.address, type: customer.type,
      currentBalance: customer.currentBalance,
      totalSpent: customer.sales.reduce((s, x) => s + x.total, 0),
      purchaseCount: customer.sales.length,
    },
    timeline,
  });
});
