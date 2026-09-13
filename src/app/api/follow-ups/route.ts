/**
 * GET  /api/follow-ups — list follow-ups (optionally by customer).
 * POST /api/follow-ups — create a follow-up note (doc §5.4).
 *
 * rating: HAPPY | NEUTRAL | UNHAPPY
 * nextDueDate: optional next follow-up date
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  customerId: z.string(),
  note: z.string().min(1).max(1000),
  rating: z.enum(["HAPPY", "NEUTRAL", "UNHAPPY"]).default("NEUTRAL"),
  nextDueDate: z.string().optional().nullable(),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId") ?? "";
  const followUps = await db.followUp.findMany({
    where: {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    followUps: followUps.map((f) => ({
      id: f.id, note: f.note, rating: f.rating,
      nextDueDate: f.nextDueDate?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
      customerName: f.customer?.name ?? "—",
      customerPhone: f.customer?.phone ?? null,
      author: f.author?.name ?? "—",
    })),
  });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { customerId, note, rating, nextDueDate } = parsed.data;

  const followUp = await db.followUp.create({
    data: {
      tenantId: user.tenantId!,
      customerId,
      note,
      rating,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      createdBy: user.id,
    },
    select: { id: true, note: true, rating: true, nextDueDate: true, createdAt: true },
  });
  return NextResponse.json({ followUp }, { status: 201 });
});
