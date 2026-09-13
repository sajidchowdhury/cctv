/**
 * GET  /api/rma — list RMA tickets (tenant-scoped) with stage + customer + product.
 * POST /api/rma — create an RMA ticket (doc §5.7).
 *
 * Auto: generates RMA-YYMMDD-###, checks warranty status of the inventory unit,
 * sets initial stage RECEIVED_FROM_CUSTOMER + creates initial history entry.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { getNotifier } from "@/lib/adapters/notifier";

const STAGES = [
  "RECEIVED_FROM_CUSTOMER",
  "SENT_TO_VENDOR",
  "UNDER_REPAIR",
  "RETURNED_FROM_VENDOR",
  "DELIVERED_TO_CUSTOMER",
];

const CreateSchema = z.object({
  customerId: z.string().optional().nullable(),
  inventoryUnitId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  faultReason: z.string().min(2).max(500),
  vendorRmaRef: z.string().max(60).optional().nullable(),
  vendorCharge: z.number().min(0).default(0),
  eta: z.string().optional().nullable(),
});

function genRmaNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `RMA-${yy}${mm}${dd}-${rand}`;
}

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") ?? "";
  const search = url.searchParams.get("q") ?? "";

  const tickets = await db.rmaTicket.findMany({
    where: {
      deletedAt: null,
      ...(stage ? { stage } : {}),
      ...(search ? { rmaNo: { contains: search } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      product: { select: { id: true, name: true, model: true } },
      supplier: { select: { id: true, name: true } },
      _count: { select: { history: true } },
    },
    orderBy: { dateOpened: "desc" },
  });

  const now = new Date();
  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id, rmaNo: t.rmaNo, dateOpened: t.dateOpened.toISOString(),
      customerName: t.customer?.name ?? "—",
      customerPhone: t.customer?.phone ?? null,
      productName: t.product?.name ?? "—",
      productModel: t.product?.model ?? null,
      supplierName: t.supplier?.name ?? "—",
      faultReason: t.faultReason, stage: t.stage,
      vendorRmaRef: t.vendorRmaRef, vendorCharge: t.vendorCharge,
      eta: t.eta?.toISOString() ?? null,
      closedAt: t.closedAt?.toISOString() ?? null,
      historyCount: t._count.history,
      overdue: t.eta && t.eta < now && t.stage !== "DELIVERED_TO_CUSTOMER",
      stageIndex: STAGES.indexOf(t.stage),
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
  const { customerId, inventoryUnitId, productId, supplierId, faultReason, vendorRmaRef, vendorCharge, eta } = parsed.data;
  const tenantId = user.tenantId!;

  // Auto-warranty check (doc §5.7): if inventory unit provided, check warranty status.
  let inWarranty = false;
  let autoProductId = productId || null;
  if (inventoryUnitId) {
    const unit = await adminDb.inventoryUnit.findUnique({
      where: { id: inventoryUnitId },
      select: { warrantyEnd: true, status: true, productId: true },
    });
    if (unit) {
      inWarranty = unit.warrantyEnd ? new Date(unit.warrantyEnd) > new Date() : false;
      // Auto-derive productId from the inventory unit if not explicitly provided.
      if (!autoProductId && unit.productId) {
        autoProductId = unit.productId;
      }
      // Mark unit as IN_RMA.
      await adminDb.inventoryUnit.update({
        where: { id: inventoryUnitId },
        data: { status: "IN_RMA" },
      });
    }
  }

  const rmaNo = genRmaNo();

  try {
    const ticket = await adminDb.$transaction(async (tx) => {
      const t = await tx.rmaTicket.create({
        data: {
          tenantId,
          rmaNo,
          customerId: customerId || null,
          inventoryUnitId: inventoryUnitId || null,
          productId: autoProductId,
          supplierId: supplierId || null,
          faultReason,
          stage: "RECEIVED_FROM_CUSTOMER",
          vendorRmaRef: vendorRmaRef || null,
          vendorCharge: vendorCharge || 0,
          eta: eta ? new Date(eta) : null,
        },
      });

      // Initial history entry.
      await tx.rmaHistory.create({
        data: {
          rmaTicketId: t.id,
          stage: "RECEIVED_FROM_CUSTOMER",
          notes: `RMA opened. ${inWarranty ? "In warranty (free)." : "Out of warranty (chargeable)."}`,
          actorUserId: user.id,
        },
      });

      return t;
    });

    // SMS customer about receipt (doc §5.7).
    if (customerId) {
      const customer = await adminDb.customer.findUnique({ where: { id: customerId }, select: { phone: true, name: true } });
      if (customer?.phone) {
        const notifier = getNotifier();
        await notifier.sendSms(customer.phone, `Your product has been received for repair. RMA: ${rmaNo}. We will notify you at each stage.`);
      }
    }

    return NextResponse.json({ id: ticket.id, rmaNo: ticket.rmaNo, inWarranty }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "RMA number collision. Try again." }, { status: 409 });
    }
    console.error("[rma/create] error:", err);
    return NextResponse.json({ error: "Failed to create RMA." }, { status: 500 });
  }
});
