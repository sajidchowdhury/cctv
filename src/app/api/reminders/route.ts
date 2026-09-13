/**
 * GET  /api/reminders — list reminders (tenant-scoped) with type/active filters.
 * POST /api/reminders — create a reminder (doc §5.5).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const REMINDER_TYPES = [
  "TRADELICENSE", "RENT", "ELECTRICITY", "INTERNET_GAS", "SALARY",
  "WARRANTY_EXPIRY", "LOW_STOCK", "FOLLOW_UP", "SERVICE_TICKET", "SUBSCRIPTION_BILL",
  "OTHER",
];
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ONCE"];

const CreateSchema = z.object({
  type: z.enum(REMINDER_TYPES as [string, ...string[]]),
  title: z.string().min(2).max(100),
  amount: z.number().min(0).optional().nullable(),
  frequency: z.enum(FREQUENCIES as [string, ...string[]]),
  nextDue: z.string(), // ISO date
  channel: z.enum(["IN_APP_SMS", "IN_APP", "SMS"]).default("IN_APP_SMS"),
  refType: z.string().optional().nullable(),
  refId: z.string().optional().nullable(),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const activeOnly = url.searchParams.get("active") !== "0";

  const reminders = await db.reminder.findMany({
    where: {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { nextDue: "asc" },
  });

  const now = new Date();
  return NextResponse.json({
    reminders: reminders.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      amount: r.amount,
      frequency: r.frequency,
      nextDue: r.nextDue.toISOString(),
      channel: r.channel,
      active: r.active,
      refType: r.refType,
      refId: r.refId,
      overdue: r.active && r.nextDue <= now,
      daysUntilDue: Math.ceil((r.nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
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
  const { type, title, amount, frequency, nextDue, channel, refType, refId } = parsed.data;

  const reminder = await db.reminder.create({
    data: {
      tenantId: user.tenantId!,
      type,
      title,
      amount: amount ?? null,
      frequency,
      nextDue: new Date(nextDue),
      channel,
      refType: refType ?? null,
      refId: refId ?? null,
    },
    select: { id: true, type: true, title: true, nextDue: true, frequency: true },
  });
  return NextResponse.json({ reminder }, { status: 201 });
});
