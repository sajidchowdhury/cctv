/**
 * POST /api/billing/submit-payment (doc §3.3)
 *
 * Tenant submits a manual payment: method, txn ID, amount, paid date,
 * sender number. Creates a PENDING PaymentVerification row for the admin queue.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenantAny } from "@/lib/session";

const SubmitSchema = z.object({
  method: z.enum(["BKASH", "NAGAD", "BANK"]),
  txnId: z.string().min(4).max(60),
  amount: z.number().positive(),
  paidDate: z.string(), // ISO date
  senderNumber: z.string().min(6).max(20).optional(),
});

export const POST = withTenantAny(async (user, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { method, txnId, amount, paidDate, senderNumber } = parsed.data;

  const pv = await adminDb.paymentVerification.create({
    data: {
      tenantId: user.tenantId,
      method,
      txnId: txnId.trim(),
      amount,
      paidDate: new Date(paidDate),
      senderNumber,
      status: "PENDING",
    },
  });

  return NextResponse.json(
    { ok: true, id: pv.id, status: pv.status },
    { status: 201 }
  );
});
