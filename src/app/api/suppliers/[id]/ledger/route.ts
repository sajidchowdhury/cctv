/**
 * GET /api/suppliers/[id]/ledger — party-wise all transactions + running balance (doc §4.5).
 *
 * Ledger = openingBalance + purchases (debits, increase payable) − payments (credits, reduce payable).
 * Returns a unified, date-sorted transaction list with a running balance.
 *
 * Note: purchases land in S08, payments in S16. Until then this returns the
 * opening balance + any existing rows. The structure is ready.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { date: "asc" },
        select: { id: true, invoiceNo: true, date: true, total: true, mode: true },
      },
      payments: {
        orderBy: { date: "asc" },
        select: { id: true, amount: true, date: true, mode: true, narration: true },
      },
    },
  });
  if (!supplier || supplier.deletedAt) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }

  // Build a unified ledger: opening + purchases (debit) − payments (credit).
  type Entry = {
    date: Date;
    type: "OPENING" | "PURCHASE" | "PAYMENT";
    ref: string;
    debit: number;  // increases what we owe (purchase)
    credit: number; // decreases what we owe (payment)
    balance: number;
    mode: string | null;
    narration: string | null;
  };

  let running = supplier.openingBalance;
  const entries: Entry[] = [];

  if (supplier.openingBalance !== 0) {
    entries.push({
      date: supplier.createdAt,
      type: "OPENING",
      ref: "Opening balance",
      debit: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
      credit: supplier.openingBalance < 0 ? -supplier.openingBalance : 0,
      balance: running,
      mode: null,
      narration: "Initial balance",
    });
  }

  // Merge + sort by date.
  const all: Entry[] = [
    ...supplier.purchases.map((p) => ({
      date: p.date,
      type: "PURCHASE" as const,
      ref: p.invoiceNo,
      debit: p.total,
      credit: 0,
      balance: 0,
      mode: p.mode,
      narration: null as string | null,
    })),
    ...supplier.payments.map((p) => ({
      date: p.date,
      type: "PAYMENT" as const,
      ref: p.narration ?? "Payment",
      debit: 0,
      credit: p.amount,
      balance: 0,
      mode: p.mode,
      narration: p.narration,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const e of all) {
    running += e.debit - e.credit;
    entries.push({ ...e, balance: running });
  }

  return NextResponse.json({
    supplier: {
      id: supplier.id,
      name: supplier.name,
      openingBalance: supplier.openingBalance,
      currentBalance: supplier.currentBalance,
      computedBalance: running,
    },
    ledger: entries.map((e) => ({
      ...e,
      date: e.date.toISOString(),
      debitDisplay: e.debit ? formatBDT(e.debit) : "—",
      creditDisplay: e.credit ? formatBDT(e.credit) : "—",
      balanceDisplay: formatBDT(e.balance),
    })),
  });
});
