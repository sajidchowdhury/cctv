/**
 * GET /api/reports/supplier-ledger — standalone supplier ledger report (F4-S1).
 *
 * Query params:
 *   ?partyId=<supplierId>  (required) — the supplier to build the ledger for
 *   ?from=YYYY-MM-DD       (optional, defaults to today)
 *   ?to=YYYY-MM-DD         (optional, defaults to from)
 *
 * Returns same shape as customer-ledger. Purchase = debit (increases payable),
 * Payment = credit (reduces).
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

  const supplier = await db.supplier.findUnique({
    where: { id: partyId },
    select: {
      id: true, name: true, phone: true, company: true,
      openingBalance: true, currentBalance: true, createdAt: true,
    },
  });
  if (!supplier || supplier.deletedAt) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }

  // Purchases in the display window (debit).
  const purchases = await db.purchase.findMany({
    where: {
      deletedAt: null,
      supplierId: partyId,
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, invoiceNo: true, date: true, total: true, mode: true },
    orderBy: { date: "asc" },
  });

  // Payments (Transaction type=PAY) in the display window (credit).
  const payments = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: "PAY",
      supplierId: partyId,
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, amount: true, date: true, mode: true, narration: true },
    orderBy: { date: "asc" },
  });

  // Opening balance = supplier.openingBalance + Σ(purchases before from) − Σ(payments before from).
  const beforePurchases = await db.purchase.aggregate({
    where: { deletedAt: null, supplierId: partyId, date: { lt: fromDate } },
    _sum: { total: true },
  });
  const beforePayments = await db.transaction.aggregate({
    where: { deletedAt: null, type: "PAY", supplierId: partyId, date: { lt: fromDate } },
    _sum: { amount: true },
  });
  const openingBalance =
    supplier.openingBalance +
    (beforePurchases._sum.total ?? 0) -
    (beforePayments._sum.amount ?? 0);

  type Entry = {
    date: Date;
    type: "OPENING" | "PURCHASE" | "PAYMENT";
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
    ...purchases.map((p) => ({
      date: p.date, type: "PURCHASE" as const, ref: p.invoiceNo,
      debit: p.total, credit: 0, mode: p.mode, narration: null as string | null,
    })),
    ...payments.map((p) => ({
      date: p.date, type: "PAYMENT" as const, ref: p.narration ?? "Payment",
      debit: 0, credit: p.amount, mode: p.mode, narration: p.narration,
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
    supplier: {
      id: supplier.id, name: supplier.name, phone: supplier.phone, company: supplier.company,
      openingBalance: supplier.openingBalance,
      currentBalance: supplier.currentBalance,
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
