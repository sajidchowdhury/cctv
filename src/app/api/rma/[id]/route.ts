/**
 * GET /api/rma/[id] — fetch RMA ticket with full stage history.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const ticket = await db.rmaTicket.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, address: true } },
      product: { select: { id: true, name: true, model: true, sku: true } },
      supplier: { select: { id: true, name: true, phone: true } },
      inventoryUnit: { select: { id: true, serialNo: true, warrantyEnd: true, status: true } },
      history: {
        orderBy: { timestamp: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!ticket || ticket.deletedAt) {
    return NextResponse.json({ error: "RMA not found." }, { status: 404 });
  }

  const now = new Date();
  return NextResponse.json({
    ticket: {
      ...ticket,
      dateOpened: ticket.dateOpened.toISOString(),
      eta: ticket.eta?.toISOString() ?? null,
      closedAt: ticket.closedAt?.toISOString() ?? null,
      overdue: ticket.eta && ticket.eta < now && ticket.stage !== "DELIVERED_TO_CUSTOMER",
      history: ticket.history.map((h) => ({
        ...h,
        timestamp: h.timestamp.toISOString(),
        actorName: h.actor?.name ?? "System",
      })),
    },
  });
});
