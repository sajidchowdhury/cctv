/**
 * GET /api/reports/customer-ledger — standalone customer ledger report (F4-S1).
 *
 * Query params:
 *   ?partyId=<customerId>  (required) — the customer to build the ledger for
 *   ?from=YYYY-MM-DD       (optional, defaults to today) — start of display window
 *   ?to=YYYY-MM-DD         (optional, defaults to from) — end of display window
 *
 * Returns:
 *   {
 *     customer: { id, name, phone, openingBalance, currentBalance, computedBalance },
 *     summary: { openingBalance, totalDebit, totalCredit, closingBalance, ...Display },
 *     ledger: [{ date, type, ref, debit, credit, balance, mode, narration, ...Display }]
 *   }
 *
 * The opening balance is computed from ALL transactions before `from` (not just
 * customer.openingBalance) so the report window shows accurate running balance.
 * Sale = debit (increases receivable), Receipt = credit (reduces).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const partyId = url.searchParams.get("partyId");
  const fromStr = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const toStr = url.searchParams.get("to") ?? fromStr;

  if (!partyId) {
    return NextResponse.json({ error: "Missing partyId." }, { status: 400 });
  }

  const fromDate = new Date(fromStr + "T00:00:00");
  const toDate = new Date(toStr + "T23:59:59");

  const customer = await db.customer.findUnique({
    where: { id: partyId },
    select: {
      id: true, name: true, phone: true,
      openingBalance: true, currentBalance: true, createdAt: true,
      deletedAt: true,
    },
  });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  // Sales in the display window (debit).
  const sales = await db.sale.findMany({
    where: {
      deletedAt: null,
      customerId: partyId,
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, invoiceNo: true, date: true, total: true, mode: true },
    orderBy: { date: "asc" },
  });

  // Receipts (Transaction type=RECV) in the display window (credit).
  const receipts = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: "RECV",
      customerId: partyId,
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, amount: true, date: true, mode: true, narration: true },
    orderBy: { date: "asc" },
  });

  // Opening balance = customer.openingBalance + Σ(sales before from) − Σ(receipts before from).
  const beforeSales = await db.sale.aggregate({
    where: { deletedAt: null, customerId: partyId, date: { lt: fromDate } },
    _sum: { total: true },
  });
  const beforeReceipts = await db.transaction.aggregate({
    where: { deletedAt: null, type: "RECV", customerId: partyId, date: { lt: fromDate } },
    _sum: { amount: true },
  });
  const openingBalance =
    customer.openingBalance +
    (beforeSales._sum.total ?? 0) -
    (beforeReceipts._sum.amount ?? 0);

  // Build entries: OPENING + sales (debit) + receipts (credit), sorted by date.
  type Entry = {
    date: Date;
    type: "OPENING" | "SALE" | "RECEIPT";
    ref: string;
    debit: number;
    credit: number;
    balance: number;
    mode: string | null;
    narration: string | null;
  };

  const entries: Entry[] = [];
  if (openingBalance !== 0) {
    entries.push({
      date: fromDate,
      type: "OPENING",
      ref: "Opening balance",
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? -openingBalance : 0,
      balance: openingBalance,
      mode: null,
      narration: `Balance brought forward from before ${fromStr}`,
    });
  }

  const all: Omit<Entry, "balance">[] = [
    ...sales.map((s) => ({
      date: s.date, type: "SALE" as const, ref: s.invoiceNo,
      debit: s.total, credit: 0, mode: s.mode, narration: null as string | null,
    })),
    ...receipts.map((r) => ({
      date: r.date, type: "RECEIPT" as const, ref: r.narration ?? "Receipt",
      debit: 0, credit: r.amount, mode: r.mode, narration: r.narration,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = openingBalance;
  for (const e of all) {
    running += e.debit - e.credit;
    entries.push({ ...e, balance: running });
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  return NextResponse.json({
    customer: {
      id: customer.id, name: customer.name, phone: customer.phone,
      openingBalance: customer.openingBalance,
      currentBalance: customer.currentBalance,
      computedBalance: running,
    },
    summary: {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      openingDisplay: formatBDT(openingBalance),
      totalDebitDisplay: formatBDT(totalDebit),
      totalCreditDisplay: formatBDT(totalCredit),
      closingDisplay: formatBDT(closingBalance),
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
