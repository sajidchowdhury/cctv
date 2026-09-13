/**
 * PATCH  /api/reminders/[id] — update a reminder (snooze, change nextDue, toggle active).
 * DELETE /api/reminders/[id] — soft-delete.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const PatchSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  type: z.string().optional(),
  amount: z.number().min(0).optional().nullable(),
  frequency: z.string().optional(),
  nextDue: z.string().optional(),
  channel: z.string().optional(),
  active: z.boolean().optional(),
});

export const PATCH = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  const data: any = { ...parsed.data };
  if (parsed.data.nextDue) data.nextDue = new Date(parsed.data.nextDue);
  const reminder = await db.reminder.update({
    where: { id }, data,
    select: { id: true, title: true, nextDue: true, active: true },
  });
  return NextResponse.json({ reminder });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db.reminder.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
