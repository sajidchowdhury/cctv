/**
 * GET  /api/sales — list sales (tenant-scoped) with customer + due.
 * POST /api/sales — create a sale with cart items (doc §4.3).
 *
 * On Save (transactional):
 *   - create Sale + SaleItems
 *   - for each serialised inventory unit: mark SOLD + link saleItemId
 *   - for SERVICE lines: no inventory unit (qty tracked only)
 *   - decrease stock (inventory unit status IN_STOCK → SOLD)
 *   - update Customer.currentBalance += due (increases receivable)
 *   - oversell blocked: serialised unit must be IN_STOCK
 *
 * Invoice No auto INV-YYMMDD-###. Customer = walk-in (null) or named.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const ItemSchema = z.object({
  productId: z.string().optional().nullable(),
  inventoryUnitId: z.string().optional().nullable(), // for serialised stock
  description: z.string().optional().nullable(), // for SERVICE lines
  lineType: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  warrantyMonths: z.number().int().min(0).default(0),
});

const CreateSchema = z.object({
  customerId: z.string().optional().nullable(),
  invoiceNo: z.string().optional(),
  date: z.string().optional(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "DUE"]).default("CASH"),
  paid: z.number().min(0).default(0),
  discount: z.number().min(0).default(0), // invoice-level
  notes: z.string().max(500).optional().nullable(),
  items: z.array(ItemSchema).min(1),
  isHeld: z.boolean().default(false),
});

function genInvoiceNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `INV-${yy}${mm}${dd}-${rand}`;
}

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const heldOnly = url.searchParams.get("held") === "1";

  const sales = await db.sale.findMany({
    where: {
      deletedAt: null,
      ...(heldOnly ? { isHeld: true } : {}),
      ...(search ? { invoiceNo: { contains: search } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: { select: { id: true, qty: true, lineTotal: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({
    sales: sales.map((s) => ({
      id: s.id,
      invoiceNo: s.invoiceNo,
      date: s.date,
      customerId: s.customerId,
      customerName: s.customer?.name ?? "Walk-in",
      total: s.total,
      paid: s.paid,
      due: s.due,
      mode: s.mode,
      isHeld: s.isHeld,
      quotationId: s.quotationId,
      itemCount: s.items.length,
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
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { customerId, invoiceNo, date, mode, paid, discount, notes, items, isHeld } = parsed.data;
  const tenantId = user.tenantId!;

  // Compute totals.
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.qty * item.unitPrice * (1 - item.discount / 100);
  }
  const total = Math.max(0, subtotal - discount);
  const due = Math.max(0, total - paid);

  // Validate inventory units are IN_STOCK + belong to the right product (oversell block).
  for (const item of items) {
    if (item.inventoryUnitId) {
      const unit = await adminDb.inventoryUnit.findUnique({
        where: { id: item.inventoryUnitId },
        select: { id: true, status: true, productId: true },
      });
      if (!unit) {
        return NextResponse.json({ error: `Inventory unit not found.` }, { status: 404 });
      }
      if (unit.status !== "IN_STOCK") {
        return NextResponse.json(
          { error: `Inventory unit already ${unit.status} — oversell blocked.` },
          { status: 409 }
        );
      }
      if (item.productId && unit.productId !== item.productId) {
        return NextResponse.json(
          { error: `Inventory unit does not belong to the selected product.` },
          { status: 422 }
        );
      }
    }
  }

  const saleDate = date ? new Date(date) : new Date();
  const finalInvoiceNo = invoiceNo?.trim() || genInvoiceNo();

  try {
    const result = await adminDb.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId,
          customerId: customerId || null,
          salesmanId: user.id,
          invoiceNo: finalInvoiceNo,
          date: saleDate,
          total,
          discount,
          paid,
          due,
          mode,
          notes: notes ?? null,
          isHeld,
        },
      });

      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice * (1 - item.discount / 100);
        const saleItem = await tx.saleItem.create({
          data: {
            tenantId,
            saleId: sale.id,
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

        // Mark the inventory unit SOLD + link saleItemId (doc §4.3).
        if (item.inventoryUnitId) {
          await tx.inventoryUnit.update({
            where: { id: item.inventoryUnitId },
            data: { status: "SOLD", saleItemId: saleItem.id },
          });
        }
      }

      // Update customer receivable += due (doc §4.3).
      if (customerId && due > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: { increment: due } },
        });
      }

      return sale;
    });

    return NextResponse.json(
      {
        id: result.id,
        invoiceNo: result.invoiceNo,
        total: result.total,
        due: result.due,
        isHeld: result.isHeld,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Invoice number collision. Try again." }, { status: 409 });
    }
    console.error("[sales/create] error:", err);
    return NextResponse.json({ error: "Failed to create sale." }, { status: 500 });
  }
});
