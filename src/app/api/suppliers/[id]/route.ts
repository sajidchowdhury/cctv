/**
 * GET    /api/suppliers/[id] — fetch a single supplier.
 * PATCH  /api/suppliers/[id] — update supplier fields.
 * DELETE /api/suppliers/[id] — soft-delete a supplier.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { date: "desc" },
        take: 50,
        select: { id: true, invoiceNo: true, date: true, total: true, paid: true, due: true, mode: true },
      },
      payments: {
        orderBy: { date: "desc" },
        take: 50,
        select: { id: true, amount: true, date: true, mode: true, narration: true },
      },
    },
  });
  if (!supplier || supplier.deletedAt) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }
  return NextResponse.json({
    supplier: {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      company: supplier.company,
      address: supplier.address,
      openingBalance: supplier.openingBalance,
      currentBalance: supplier.currentBalance,
      purchases: supplier.purchases,
      payments: supplier.payments,
    },
  });
});

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
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

  // If openingBalance changes, recompute currentBalance delta.
  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }
  const data: any = { ...parsed.data };
  if (parsed.data.openingBalance !== undefined) {
    const delta = parsed.data.openingBalance - existing.openingBalance;
    data.currentBalance = existing.currentBalance + delta;
  }

  const supplier = await db.supplier.update({
    where: { id },
    data,
    select: { id: true, name: true, currentBalance: true, openingBalance: true },
  });
  return NextResponse.json({ supplier });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
