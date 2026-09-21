/**
 * GET  /api/transactions — list income/expense transactions (tenant-scoped).
 * POST /api/transactions — create an income or expense transaction (doc §4.4).
 *
 * Cash-book style single-entry. type IN (income) or EXP (expense).
 * RECV (customer receipts) + PAY (supplier payments) land in S16.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  type: z.enum(["IN", "EXP"]),
  accountHeadId: z.string().optional().nullable(),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "BANK", "BKASH", "NAGAD", "CHEQUE"]).default("CASH"),
  date: z.string().optional(),
  narration: z.string().max(500).optional().nullable(),
  attachmentUrl: z.string().regex(/^(https?:\/\/|\/).+/, "Must be a URL or root-relative path").optional().nullable(),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const headId = url.searchParams.get("headId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const txns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: { in: ["IN", "EXP"] },
      ...(type ? { type } : {}),
      ...(headId ? { accountHeadId: headId } : {}),
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    include: {
      accountHead: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json({
    transactions: txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      mode: t.mode,
      date: t.date,
      narration: t.narration,
      accountHead: t.accountHead?.name ?? null,
      accountHeadId: t.accountHeadId,
      attachmentUrl: t.attachmentUrl,
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
  const { type, accountHeadId, amount, mode, date, narration, attachmentUrl } = parsed.data;

  const txn = await db.transaction.create({
    data: {
      tenantId: user.tenantId!,
      type,
      partyType: "NONE",
      accountHeadId: accountHeadId || null,
      amount,
      mode,
      date: date ? new Date(date) : new Date(),
      narration: narration ?? null,
      attachmentUrl: attachmentUrl ?? null,
    },
    select: { id: true, type: true, amount: true, mode: true, date: true },
  });
  return NextResponse.json({ transaction: txn }, { status: 201 });
});
