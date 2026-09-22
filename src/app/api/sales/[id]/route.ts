/**
 * GET    /api/sales/[id] — fetch a sale with items + inventory units.
 * PATCH  /api/sales/[id] — finalize held sale OR edit full sale (items + stock + ledger reversal).
 * DELETE /api/sales/[id] — soft-delete: restore inventory units + reverse customer balance.
 *
 * F2-S2: Full sale edit with stock + ledger reversal.
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
          // Phase 2: include unit relation so the invoice can render a UoM column.
          product: { select: { id: true, name: true, model: true, sku: true, unit: { select: { name: true } } } },
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

// ─── Simple PATCH: finalize held sale (paid/due/mode/notes only) ──────────
const SimplePatchSchema = z.object({
  isHeld: z.boolean().optional(),
  paid: z.number().min(0).optional(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "DUE"]).optional(),
  notes: z.string().max(500).optional().nullable(),
});

// ─── Full Edit PATCH: replace all items + reverse + reapply stock/ledger ──
const EditItemSchema = z.object({
  productId: z.string().optional().nullable(),
  inventoryUnitId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lineType: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  warrantyMonths: z.number().int().min(0).default(0),
});

const EditSchema = z.object({
  editMode: z.literal(true),
  customerId: z.string().optional().nullable(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "DUE"]).default("CASH"),
  paid: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(EditItemSchema).min(1),
});

export const PATCH = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Check if this is a full edit (editMode: true) or simple finalize.
  const isFullEdit = (body as any)?.editMode === true;

  // ─── Simple finalize ──────────────────────────────────────
  if (!isFullEdit) {
    const parsed = SimplePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
    }

    const existing = await db.sale.findUnique({ where: { id }, include: { items: true } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Sale not found." }, { status: 404 });
    }

    const data: any = { ...parsed.data };
    if (parsed.data.paid !== undefined || parsed.data.isHeld === false) {
      const paid = parsed.data.paid ?? existing.paid;
      data.due = Math.max(0, existing.total - paid);
      if (existing.customerId && data.due !== existing.due) {
        const delta = data.due - existing.due;
        await adminDb.customer.update({
          where: { id: existing.customerId },
          data: { currentBalance: { increment: delta } },
        });
      }
    }

    const sale = await db.sale.update({
      where: { id }, data,
      select: { id: true, invoiceNo: true, due: true, isHeld: true },
    });
    return NextResponse.json({ sale });
  }

  // ─── Full edit: replace items + reverse stock + reapply ───
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { customerId, mode, paid, discount, notes, items } = parsed.data;

  const existing = await adminDb.sale.findUnique({
    where: { id },
    include: {
      items: { include: { inventoryUnit: true } },
      customer: { select: { id: true } },
    },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  if (existing.isHeld) {
    return NextResponse.json({ error: "Cannot edit a held sale. Finalize it first." }, { status: 422 });
  }

  // Compute new totals.
  let newSubtotal = 0;
  for (const item of items) {
    newSubtotal += item.qty * item.unitPrice * (1 - item.discount / 100);
  }
  const newTotal = Math.max(0, newSubtotal - discount);
  const newDue = Math.max(0, newTotal - paid);

  try {
    const result = await adminDb.$transaction(async (tx) => {
      // ── STEP 1: REVERSE old sale effects ──────────────────
      // Restore all old inventory units to IN_STOCK.
      for (const oldItem of existing.items) {
        if (oldItem.inventoryUnitId) {
          await tx.inventoryUnit.update({
            where: { id: oldItem.inventoryUnitId },
            data: { status: "IN_STOCK", saleItemId: null },
          });
        }
      }
      // Delete old sale items.
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      // Reverse old customer balance change.
      if (existing.customerId && existing.due > 0) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { currentBalance: { decrement: existing.due } },
        });
      }

      // ── STEP 2: APPLY new sale effects ─────────────────────
      // Update sale header.
      await tx.sale.update({
        where: { id },
        data: {
          customerId: customerId || null,
          total: newTotal,
          discount,
          paid,
          due: newDue,
          mode,
          notes: notes ?? null,
        },
      });

      // Create new sale items + mark inventory units SOLD.
      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice * (1 - item.discount / 100);
        const saleItem = await tx.saleItem.create({
          data: {
            tenantId: existing.tenantId,
            saleId: id,
            productId: item.productId || null,
            inventoryUnitId: item.inventoryUnitId || null,
            description: item.description ?? null,
            lineType: item.lineType,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            warrantyMonths: item.warrantyMonths,
            lineTotal,
          },
        });

        if (item.inventoryUnitId) {
          // Validate the unit is IN_STOCK (not already sold in this edit).
          const unit = await tx.inventoryUnit.findUnique({
            where: { id: item.inventoryUnitId },
            select: { status: true },
          });
          if (unit && unit.status !== "IN_STOCK") {
            throw new Error(`Inventory unit ${item.inventoryUnitId} is already ${unit.status}.`);
          }
          await tx.inventoryUnit.update({
            where: { id: item.inventoryUnitId },
            data: { status: "SOLD", saleItemId: saleItem.id },
          });
        }
      }

      // Apply new customer balance change.
      if (customerId && newDue > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: { increment: newDue } },
        });
      }

      return { newTotal, newDue };
    });

    return NextResponse.json({
      ok: true,
      sale: { id, total: result.newTotal, due: result.newDue },
      message: "Sale updated. Stock and ledger reversed + reapplied.",
    });
  } catch (err: any) {
    console.error("[sales/edit] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to edit sale." },
      { status: 500 }
    );
  }
});

// ─── DELETE: soft delete + restore units + reverse balance ────────────────
export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await adminDb.sale.findUnique({
    where: { id },
    include: { items: { include: { inventoryUnit: true } } },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  try {
    await adminDb.$transaction(async (tx) => {
      // Restore all inventory units to IN_STOCK.
      for (const item of existing.items) {
        if (item.inventoryUnitId) {
          await tx.inventoryUnit.update({
            where: { id: item.inventoryUnitId },
            data: { status: "IN_STOCK", saleItemId: null },
          });
        }
      }

      // Reverse customer balance change.
      if (existing.customerId && existing.due > 0) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { currentBalance: { decrement: existing.due } },
        });
      }

      // Delete sale items + soft delete sale.
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.update({ where: { id }, data: { deletedAt: new Date(), total: 0, paid: 0, due: 0 } });
    });

    return NextResponse.json({ ok: true, message: "Sale deleted. All inventory units restored to stock. Customer balance reversed." });
  } catch (err: any) {
    console.error("[sales/delete] error:", err);
    return NextResponse.json({ error: "Failed to delete sale." }, { status: 500 });
  }
});
