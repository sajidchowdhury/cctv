/**
 * GET  /api/receipts — list customer receipts (RECV transactions).
 * POST /api/receipts — create a customer receipt (doc §4.5 money-in).
 *
 * On create (transactional):
 *   - create Transaction (type=RECV, partyType=CUSTOMER, customerId)
 *   - auto-allocate amount FIFO across selected open invoices (oldest first)
 *   - update each settled sale's paid + due
 *   - update Customer.currentBalance -= amount (reduces receivable)
 *   - any residual = adjustment (discount/round-off) — recorded in narration
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  customerId: z.string(),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CHEQUE"]).default("CASH"),
  date: z.string().optional(),
  narration: z.string().max(500).optional().nullable(),
  adjustment: z.number().default(0), // discount/round-off
  invoiceIds: z.array(z.string()).default([]), // selected invoices (FIFO if empty = auto)
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const txns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: "RECV",
      ...(search ? { narration: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json({
    receipts: txns.map((t) => ({
      id: t.id, amount: t.amount, mode: t.mode, date: t.date,
      narration: t.narration, customerName: t.customer?.name ?? "—",
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
  const { customerId, amount, mode, date, narration, adjustment, invoiceIds } = parsed.data;
  const tenantId = user.tenantId!;

  // Fetch open invoices for this customer (FIFO order).
  let openInvoices = await db.sale.findMany({
    where: { deletedAt: null, isHeld: false, due: { gt: 0 }, customerId, ...(invoiceIds.length ? { id: { in: invoiceIds } } : {}) },
    orderBy: { date: "asc" },
    select: { id: true, invoiceNo: true, due: true },
  });

  // FIFO allocate: distribute amount across invoices oldest-first.
  let remaining = amount + adjustment; // adjustment increases settling power
  const settlements: { invoiceId: string; invoiceNo: string; settled: number }[] = [];

  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const settle = Math.min(inv.due, remaining);
    settlements.push({ invoiceId: inv.id, invoiceNo: inv.invoiceNo, settled: settle });
    remaining -= settle;
  }

  // Residual after all invoices settled = unallocated (advance or over-payment).
  const residual = Math.max(0, remaining);

  try {
    const result = await adminDb.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          tenantId,
          type: "RECV",
          partyType: "CUSTOMER",
          customerId,
          amount,
          mode,
          date: date ? new Date(date) : new Date(),
          narration: narration ?? (settlements.length > 0
            ? `Settled: ${settlements.map((s) => s.invoiceNo).join(", ")}${residual > 0 ? ` + ৳${residual.toFixed(2)} advance` : ""}`
            : null),
        },
      });

      // Update each settled invoice's paid + due.
      for (const s of settlements) {
        await tx.sale.update({
          where: { id: s.invoiceId },
          data: { paid: { increment: s.settled }, due: { decrement: s.settled } },
        });
      }

      // Update customer currentBalance -= amount (reduces receivable).
      await tx.customer.update({
        where: { id: customerId },
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
        ? `Receipt recorded. Settled ${result.settlements.length} invoice(s)${result.residual > 0 ? ` + ৳${result.residual.toFixed(2)} advance` : ""}.`
        : "Receipt recorded (no open invoices — stored as advance).",
    }, { status: 201 });
  } catch (err: any) {
    console.error("[receipts/create] error:", err);
    return NextResponse.json({ error: "Failed to create receipt." }, { status: 500 });
  }
});
