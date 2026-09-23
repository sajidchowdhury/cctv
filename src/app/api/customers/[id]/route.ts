/**
 * GET    /api/customers/[id] — fetch a customer with recent sales + ledger summary.
 * PATCH  /api/customers/[id] — update customer fields.
 * DELETE /api/customers/[id] — soft-delete a customer.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { date: "desc" },
        take: 20,
        where: { deletedAt: null, isHeld: false },
        select: { id: true, invoiceNo: true, date: true, total: true, paid: true, due: true, mode: true },
      },
      receipts: {
        orderBy: { date: "desc" },
        take: 20,
        select: { id: true, amount: true, date: true, mode: true, narration: true },
      },
    },
  });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  return NextResponse.json({ customer });
});

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  type: z.enum(["RETAIL", "INSTALLER", "WALK_IN"]).optional(),
  openingBalance: z.number().optional(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  // If openingBalance changes, recompute currentBalance delta (same as supplier).
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  const data: any = { ...parsed.data };
  if (parsed.data.openingBalance !== undefined) {
    const delta = parsed.data.openingBalance - existing.openingBalance;
    data.currentBalance = existing.currentBalance + delta;
  }

  const customer = await db.customer.update({
    where: { id },
    data,
    select: { id: true, name: true, currentBalance: true, openingBalance: true },
  });
  return NextResponse.json({ customer });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
