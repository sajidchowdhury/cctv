/**
 * GET    /api/sales/[id] — fetch a sale with items + inventory units.
 * PATCH  /api/sales/[id] — finalize a held sale (un-hold, set paid/due/mode).
 * DELETE /api/sales/[id] — soft-delete a sale (restores inventory units to IN_STOCK).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, address: true } },
      salesman: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, model: true, sku: true } },
          inventoryUnit: { select: { id: true, serialNo: true, status: true, warrantyEnd: true } },
        },
      },
    },
  });
  if (!sale || sale.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  return NextResponse.json({
    sale: {
      ...sale,
      items: sale.items.map((it) => ({ ...it })),
    },
  });
});

const PatchSchema = z.object({
  isHeld: z.boolean().optional(),
  paid: z.number().min(0).optional(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "DUE"]).optional(),
  notes: z.string().max(500).optional().nullable(),
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

  // If finalizing (isHeld=false) + paid changes, recompute due + update customer balance.
  const existing = await db.sale.findUnique({ where: { id }, include: { items: true } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  if (parsed.data.paid !== undefined || parsed.data.isHeld === false) {
    const paid = parsed.data.paid ?? existing.paid;
    data.due = Math.max(0, existing.total - paid);
    // If customer + due changed, update receivable.
    if (existing.customerId && data.due !== existing.due) {
      const delta = data.due - existing.due;
      await adminDb.customer.update({
        where: { id: existing.customerId },
        data: { currentBalance: { increment: delta } },
      });
    }
  }

  const sale = await db.sale.update({
    where: { id },
    data,
    select: { id: true, invoiceNo: true, due: true, isHeld: true },
  });
  return NextResponse.json({ sale });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  // Restore inventory units to IN_STOCK on delete (doc §3.1 soft delete).
  await adminDb.$transaction([
    adminDb.inventoryUnit.updateMany({
      where: { saleItem: { saleId: id } },
      data: { status: "IN_STOCK", saleItemId: null },
    }),
    adminDb.saleItem.deleteMany({ where: { saleId: id } }),
    adminDb.sale.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
});
