/**
 * GET /api/customers/[id]/ledger — party-wise transactions + running balance (doc §4.5).
 *
 * Ledger = openingBalance + sales (debit, increases receivable) − receipts (credit, reduces).
 * Returns a unified, date-sorted transaction list with running balance.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { date: "asc" },
        where: { deletedAt: null },
        select: { id: true, invoiceNo: true, date: true, total: true, mode: true },
      },
      receipts: {
        orderBy: { date: "asc" },
        select: { id: true, amount: true, date: true, mode: true, narration: true },
      },
    },
  });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  let running = customer.openingBalance;
  const entries: any[] = [];

  if (customer.openingBalance !== 0) {
    entries.push({
      date: customer.createdAt,
      type: "OPENING",
      ref: "Opening balance",
      debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
      credit: customer.openingBalance < 0 ? -customer.openingBalance : 0,
      balance: running,
      mode: null,
      narration: "Initial balance",
    });
  }

  const all = [
    ...customer.sales.map((s) => ({
      date: s.date, type: "SALE" as const, ref: s.invoiceNo,
      debit: s.total, credit: 0, balance: 0, mode: s.mode, narration: null as string | null,
    })),
    ...customer.receipts.map((r) => ({
      date: r.date, type: "RECEIPT" as const, ref: r.narration ?? "Receipt",
      debit: 0, credit: r.amount, balance: 0, mode: r.mode, narration: r.narration,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const e of all) {
    running += e.debit - e.credit;
    entries.push({ ...e, balance: running });
  }

  return NextResponse.json({
    customer: {
      id: customer.id, name: customer.name,
      openingBalance: customer.openingBalance,
      currentBalance: customer.currentBalance,
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
