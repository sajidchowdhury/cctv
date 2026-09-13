/**
 * GET    /api/purchases/[id] — fetch a single purchase with items + inventory units.
 * PATCH  /api/purchases/[id] — full edit (replace items + reverse stock + reapply ledger).
 * DELETE /api/purchases/[id] — soft delete: delete inventory units + reverse supplier balance.
 *
 * F1-S3: Purchase edit + delete + ledger reversal.
 *
 * Reversal strategy (diverges from sales because purchases CREATE units, not flip status):
 *   - On edit: hard-delete old InventoryUnits for this purchase, then delete old PurchaseItems,
 *     reverse Supplier.currentBalance by old due, re-create items + units, apply new due.
 *   - On delete: hard-delete InventoryUnits + PurchaseItems, reverse Supplier.currentBalance,
 *     soft-delete Purchase (preserve audit row with deletedAt set).
 *
 * Guard: if existing.paid > 0 the purchase has been settled by a supplier payment
 * (FIFO allocation in /api/payments). Editing/deleting such a purchase would leave
 * orphaned settlements in the linked Transaction → we return 422 with a clear message.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, company: true, phone: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, model: true, sku: true, isSerialised: true } },
          inventoryUnits: { select: { id: true, serialNo: true, status: true, warrantyEnd: true } },
        },
      },
    },
  });
  if (!purchase || purchase.deletedAt) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }
  return NextResponse.json({
    purchase: {
      id: purchase.id,
      invoiceNo: purchase.invoiceNo,
      date: purchase.date,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name ?? "Walk-in",
      supplier: purchase.supplier,
      total: purchase.total,
      paid: purchase.paid,
      due: purchase.due,
      mode: purchase.mode,
      notes: purchase.notes,
      items: purchase.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product.name,
        productModel: it.product.model,
        productSku: it.product.sku,
        isSerialised: it.product.isSerialised, // F1-S2
        qty: it.qty,
        unitPrice: it.unitPrice,
        salesPrice: it.salesPrice,
        warrantyMonths: it.warrantyMonths,
        lineTotal: it.lineTotal,
        serials: JSON.parse(it.serials) as string[],
        inventoryUnits: it.inventoryUnits,
      })),
    },
  });
});

// ─── Full Edit PATCH schema ──────────────────────────────────────────────
const EditItemSchema = z.object({
  productId: z.string(),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  salesPrice: z.number().min(0).optional().nullable(),
  warrantyMonths: z.number().int().min(0).default(0),
  serials: z.array(z.string()).default([]),
});

const EditSchema = z.object({
  editMode: z.literal(true),
  supplierId: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // ISO; defaults to existing date
  mode: z.enum(["CASH", "BANK", "BKASH", "DUE"]).default("CASH"),
  paid: z.number().min(0).default(0),
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

  // Only full-edit is supported for purchases (no "held" finalize flow).
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { supplierId, invoiceNo, date, mode, paid, notes, items } = parsed.data;
  const tenantId = user.tenantId!;

  const existing = await adminDb.purchase.findUnique({
    where: { id },
    include: { items: { include: { inventoryUnits: true } } },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }

  // Guard: cannot edit a purchase that's been settled by a payment (would orphan allocations).
  if (existing.paid > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot edit a purchase that has payments settled against it. Reverse the supplier payment(s) first.",
      },
      { status: 422 }
    );
  }

  // Compute new totals.
  let newTotal = 0;
  for (const item of items) {
    newTotal += item.qty * item.unitPrice;
  }
  const newDue = Math.max(0, newTotal - paid);

  // Validate serials unique tenant-wide, EXCLUDING this purchase's own current units.
  const allSerials = items.flatMap((it) => it.serials);
  if (allSerials.length > 0) {
    const conflicting = await adminDb.inventoryUnit.findMany({
      where: { tenantId, serialNo: { in: allSerials }, purchaseId: { not: id } },
      select: { serialNo: true },
    });
    if (conflicting.length > 0) {
      return NextResponse.json(
        { error: `Serial numbers already exist: ${conflicting.map((e) => e.serialNo).join(", ")}` },
        { status: 409 }
      );
    }
  }

  // Validate serial count ≤ qty.
  for (const item of items) {
    if (item.serials.length > item.qty) {
      return NextResponse.json(
        { error: `Serial count (${item.serials.length}) exceeds qty (${item.qty}) for a product.` },
        { status: 422 }
      );
    }
  }

  // Resolve invoice number + date.
  const finalInvoiceNo = invoiceNo?.trim() || existing.invoiceNo;
  const newDate = date ? new Date(date) : existing.date;

  try {
    const result = await adminDb.$transaction(async (tx) => {
      // ── STEP 1: REVERSE old purchase effects ───────────────────
      // Delete old inventory units (created at purchase time, hard-delete — they don't exist elsewhere).
      await tx.inventoryUnit.deleteMany({ where: { purchaseId: id } });
      // Delete old purchase items.
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      // Reverse old supplier balance change.
      if (existing.supplierId && existing.due > 0) {
        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { currentBalance: { decrement: existing.due } },
        });
      }

      // ── STEP 2: APPLY new purchase effects ─────────────────────
      await tx.purchase.update({
        where: { id },
        data: {
          supplierId: supplierId || null,
          invoiceNo: finalInvoiceNo,
          date: newDate,
          total: newTotal,
          paid,
          due: newDue,
          mode,
          notes: notes ?? null,
        },
      });

      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice;
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            tenantId,
            purchaseId: id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            salesPrice: item.salesPrice ?? null,
            warrantyMonths: item.warrantyMonths,
            serials: JSON.stringify(item.serials),
            lineTotal,
          },
        });

        // Auto-fill product.defaultPrice when salesPrice is provided.
        if (item.salesPrice) {
          await tx.product.update({
            where: { id: item.productId },
            data: { defaultPrice: item.salesPrice },
          });
        }

        const warrantyEnd =
          item.warrantyMonths > 0
            ? new Date(newDate.getTime() + item.warrantyMonths * 30 * DAY_MS)
            : null;

        for (const serialNo of item.serials) {
          await tx.inventoryUnit.create({
            data: {
              tenantId,
              productId: item.productId,
              serialNo,
              purchaseId: id,
              purchaseItemId: purchaseItem.id,
              status: "IN_STOCK",
              warrantyEnd,
            },
          });
        }
      }

      // Apply new supplier balance change.
      if (supplierId && newDue > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: { increment: newDue } },
        });
      }

      return { newTotal, newDue };
    });

    return NextResponse.json({
      ok: true,
      purchase: { id, invoiceNo: finalInvoiceNo, total: result.newTotal, due: result.newDue },
      message: "Purchase updated. Inventory units + supplier ledger reversed and reapplied.",
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Invoice number already exists. Set a unique one." },
        { status: 409 }
      );
    }
    console.error("[purchases/edit] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to edit purchase." },
      { status: 500 }
    );
  }
});

// ─── DELETE: soft delete + delete units + reverse supplier balance ──────
export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await adminDb.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }

  // Guard: cannot delete a purchase with settled payments.
  if (existing.paid > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a purchase that has payments settled against it. Reverse the supplier payment(s) first.",
      },
      { status: 422 }
    );
  }

  // Verify none of the inventory units are SOLD / IN_RMA / etc. (only allow delete if all still IN_STOCK).
  const units = await adminDb.inventoryUnit.findMany({
    where: { purchaseId: id },
    select: { id: true, status: true, saleItemId: true },
  });
  const nonInStock = units.filter((u) => u.status !== "IN_STOCK");
  if (nonInStock.length > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a purchase whose units have been sold or are in RMA. Restore all units to IN_STOCK first.",
      },
      { status: 422 }
    );
  }

  try {
    await adminDb.$transaction(async (tx) => {
      // Hard-delete all inventory units created by this purchase.
      await tx.inventoryUnit.deleteMany({ where: { purchaseId: id } });
      // Hard-delete purchase items.
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      // Reverse supplier balance change.
      if (existing.supplierId && existing.due > 0) {
        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { currentBalance: { decrement: existing.due } },
        });
      }
      // Soft-delete the purchase header (preserve audit row).
      await tx.purchase.update({
        where: { id },
        data: { deletedAt: new Date(), total: 0, paid: 0, due: 0 },
      });
    });

    return NextResponse.json({
      ok: true,
      message:
        "Purchase deleted. All inventory units removed and supplier balance reversed.",
    });
  } catch (err: any) {
    console.error("[purchases/delete] error:", err);
    return NextResponse.json({ error: "Failed to delete purchase." }, { status: 500 });
  }
});
