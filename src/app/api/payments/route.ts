/**
 * GET  /api/payments — list supplier payments (PAY transactions).
 * POST /api/payments — create a supplier payment (doc §4.5 money-out).
 *
 * On create (transactional):
 *   - create Transaction (type=PAY, partyType=SUPPLIER, supplierId)
 *   - auto-allocate amount FIFO across selected open purchases (oldest first)
 *   - update each settled purchase's paid + due
 *   - update Supplier.currentBalance -= amount (reduces payable)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  supplierId: z.string(),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CHEQUE"]).default("CASH"),
  date: z.string().optional(),
  narration: z.string().max(500).optional().nullable(),
  adjustment: z.number().default(0),
  invoiceIds: z.array(z.string()).default([]),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const txns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: "PAY",
      ...(search ? { narration: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json({
    payments: txns.map((t) => ({
      id: t.id, amount: t.amount, mode: t.mode, date: t.date,
      narration: t.narration, supplierName: t.supplier?.name ?? "—",
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
  const { supplierId, amount, mode, date, narration, adjustment, invoiceIds } = parsed.data;
  const tenantId = user.tenantId!;

  let openInvoices = await db.purchase.findMany({
    where: { deletedAt: null, due: { gt: 0 }, supplierId, ...(invoiceIds.length ? { id: { in: invoiceIds } } : {}) },
    orderBy: { date: "asc" },
    select: { id: true, invoiceNo: true, due: true },
  });

  let remaining = amount + adjustment;
  const settlements: { invoiceId: string; invoiceNo: string; settled: number }[] = [];

  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const settle = Math.min(inv.due, remaining);
    settlements.push({ invoiceId: inv.id, invoiceNo: inv.invoiceNo, settled: settle });
    remaining -= settle;
  }
  const residual = Math.max(0, remaining);

  try {
    const result = await adminDb.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          tenantId,
          type: "PAY",
          partyType: "SUPPLIER",
          supplierId,
          amount,
          mode,
          date: date ? new Date(date) : new Date(),
          narration: narration ?? (settlements.length > 0
            ? `Settled: ${settlements.map((s) => s.invoiceNo).join(", ")}${residual > 0 ? ` + ৳${residual.toFixed(2)} advance` : ""}`
            : null),
        },
      });

      for (const s of settlements) {
        await tx.purchase.update({
          where: { id: s.invoiceId },
          data: { paid: { increment: s.settled }, due: { decrement: s.settled } },
        });
      }

      await tx.supplier.update({
        where: { id: supplierId },
        data: { currentBalance: { decrement: amount } },
      });

      return { txn, settlements, residual };
    });

    return NextResponse.json({
      ok: true,
      id: result.txn.id,
      settled: result.settlements.map((s) => ({ invoiceNo: s.invoiceNo, amount: s.settled })),
      residual: result.residual,
      message: result.settlements.length > 0
        ? `Payment recorded. Settled ${result.settlements.length} invoice(s)${result.residual > 0 ? ` + ৳${result.residual.toFixed(2)} advance` : ""}.`
        : "Payment recorded (no open invoices — stored as advance).",
    }, { status: 201 });
  } catch (err: any) {
    console.error("[payments/create] error:", err);
    return NextResponse.json({ error: "Failed to create payment." }, { status: 500 });
  }
});
