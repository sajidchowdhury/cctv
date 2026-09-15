/**
 * GET  /api/purchases — list purchases (tenant-scoped) with supplier info.
 * POST /api/purchases — create a purchase with cart items + serial capture.
 *
 * Doc §4.2: multi-row cart, serial bulk-paste/scan, fractional qty,
 * warranty per line, payment mode drives supplier payable.
 *
 * On Save (transactional):
 *   - create Purchase + PurchaseItems
 *   - for each serial in each item: create an InventoryUnit (IN_STOCK,
 *     warrantyEnd = date + warrantyMonths)
 *   - for items with qty but no serials (fractional cable): no inventory units,
 *     stock tracked via PurchaseItem.qty (the products API counts both)
 *   - update Supplier.currentBalance += due (increases payable)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

const ItemSchema = z.object({
  productId: z.string(),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  salesPrice: z.number().min(0).optional().nullable(),
  warrantyMonths: z.number().int().min(0).default(0),
  serials: z.array(z.string()).default([]), // empty for fractional/non-serialised
});

const CreateSchema = z.object({
  supplierId: z.string().optional().nullable(),
  invoiceNo: z.string().optional(), // auto-generated if absent
  date: z.string().optional(), // ISO; defaults to now
  mode: z.enum(["CASH", "BANK", "BKASH", "DUE"]).default("CASH"),
  paid: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

function genInvoiceNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PUR-${yy}${mm}${dd}-${rand}`;
}

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const supplierId = url.searchParams.get("supplierId") ?? undefined;

  const purchases = await db.purchase.findMany({
    where: {
      deletedAt: null,
      ...(supplierId ? { supplierId } : {}),
      ...(search ? { invoiceNo: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { select: { id: true, productId: true, qty: true, unitPrice: true, lineTotal: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      id: p.id,
      invoiceNo: p.invoiceNo,
      date: p.date,
      supplierId: p.supplierId,
      supplierName: p.supplier?.name ?? "Walk-in",
      total: p.total,
      paid: p.paid,
      due: p.due,
      mode: p.mode,
      itemCount: p.items.length,
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
  const { supplierId, invoiceNo, date, mode, paid, notes, items } = parsed.data;
  const tenantId = user.tenantId!;

  // Compute totals.
  let total = 0;
  for (const item of items) {
    total += item.qty * item.unitPrice;
  }
  const due = Math.max(0, total - paid);

  // Auto invoice number if not provided.
  let finalInvoiceNo = invoiceNo?.trim() || genInvoiceNo();

  // Validate serials are unique within this tenant (doc §5.1 — serials must be unique).
  const allSerials = items.flatMap((it) => it.serials);
  if (allSerials.length > 0) {
    const existing = await adminDb.inventoryUnit.findMany({
      where: { tenantId, serialNo: { in: allSerials } },
      select: { serialNo: true },
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Serial numbers already exist: ${existing.map((e) => e.serialNo).join(", ")}` },
        { status: 409 }
      );
    }
  }

  // Validate serial count ≤ qty for serialised items.
  for (const item of items) {
    if (item.serials.length > item.qty) {
      return NextResponse.json(
        { error: `Serial count (${item.serials.length}) exceeds qty (${item.qty}) for a product.` },
        { status: 422 }
      );
    }
  }

  const purchaseDate = date ? new Date(date) : new Date();

  // Transactional create: purchase + items + inventory units + supplier balance.
  try {
    const result = await adminDb.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          supplierId: supplierId || null,
          invoiceNo: finalInvoiceNo,
          date: purchaseDate,
          total,
          paid,
          due,
          mode,
          notes: notes ?? null,
        },
      });

      // Create each purchase item + its inventory units.
      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice;
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            tenantId,
            purchaseId: purchase.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            salesPrice: item.salesPrice ?? null,
            warrantyMonths: item.warrantyMonths,
            serials: JSON.stringify(item.serials),
            lineTotal,
          },
        });

        // Update product defaultPrice if salesPrice provided (doc §4.2 auto-fills).
        if (item.salesPrice) {
          await tx.product.update({
            where: { id: item.productId },
            data: { defaultPrice: item.salesPrice },
          });
        }

        // Create inventory units for each serial (doc §4.2 + §5.1).
        const warrantyEnd =
          item.warrantyMonths > 0
            ? new Date(purchaseDate.getTime() + item.warrantyMonths * 30 * DAY_MS)
            : null;

        for (const serialNo of item.serials) {
          await tx.inventoryUnit.create({
            data: {
              tenantId,
              productId: item.productId,
              serialNo,
              purchaseId: purchase.id,
              purchaseItemId: purchaseItem.id,
              status: "IN_STOCK",
              warrantyEnd,
            },
          });
        }
      }

      // Update supplier currentBalance += due (increases payable) (doc §4.5).
      if (supplierId && due > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: { increment: due } },
        });
      }

      return purchase;
    });

    return NextResponse.json(
      {
        id: result.id,
        invoiceNo: result.invoiceNo,
        total: result.total,
        due: result.due,
        inventoryUnitsCreated: allSerials.length,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Invoice number already exists. Try again or set a unique one." },
        { status: 409 }
      );
    }
    console.error("[purchases/create] error:", err);
    return NextResponse.json({ error: "Failed to create purchase." }, { status: 500 });
  }
});
