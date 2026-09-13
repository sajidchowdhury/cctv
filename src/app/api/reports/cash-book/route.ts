/**
 * GET /api/reports/cash-book — day-wise cash in/out with closing balance (doc §4.4, §5.3).
 *
 * Daily cash summary = opening cash + receipts (sales cash + other income)
 *                     − payments (expense + supplier).
 *
 * For S15: computes from IN/EXP transactions + sales cash + purchases cash.
 * Receipts (S16) + supplier payments (S16) added later.
 *
 * Query: date (single day) or from + to (range).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const from = url.searchParams.get("from") ?? dateStr ?? new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? dateStr ?? from;

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  // Fetch IN/EXP transactions in range.
  const txns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: { in: ["IN", "EXP"] },
      date: { gte: fromDate, lte: toDate },
      mode: "CASH", // cash-book tracks cash only
    },
    include: { accountHead: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  // Fetch cash sales in range (doc §4.4: receipts = sales cash + other income).
  const cashSales = await db.sale.findMany({
    where: {
      deletedAt: null,
      isHeld: false,
      mode: "CASH",
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, invoiceNo: true, date: true, paid: true },
  });

  // Fetch cash purchases in range (doc §4.4: payments = expense + supplier).
  const cashPurchases = await db.purchase.findMany({
    where: {
      deletedAt: null,
      mode: "CASH",
      date: { gte: fromDate, lte: toDate },
    },
    select: { id: true, invoiceNo: true, date: true, paid: true },
  });

  // Opening cash = sum of all CASH IN/EXP before the range start.
  const beforeTxns = await db.transaction.findMany({
    where: {
      deletedAt: null,
      type: { in: ["IN", "EXP"] },
      mode: "CASH",
      date: { lt: fromDate },
    },
    select: { type: true, amount: true },
  });
  const beforeSales = await db.sale.findMany({
    where: { deletedAt: null, isHeld: false, mode: "CASH", date: { lt: fromDate } },
    select: { paid: true },
  });
  const beforePurchases = await db.purchase.findMany({
    where: { deletedAt: null, mode: "CASH", date: { lt: fromDate } },
    select: { paid: true },
  });

  let openingCash = 0;
  for (const t of beforeTxns) openingCash += t.type === "IN" ? t.amount : -t.amount;
  for (const s of beforeSales) openingCash += s.paid;
  for (const p of beforePurchases) openingCash -= p.paid;

  // Build entries for the day.
  const entries: any[] = [];

  // Income transactions.
  for (const t of txns.filter((t) => t.type === "IN")) {
    entries.push({
      date: t.date, type: "INCOME", ref: t.accountHead?.name ?? "Income",
      amount: t.amount, direction: "in", narration: t.narration,
    });
  }
  // Expense transactions.
  for (const t of txns.filter((t) => t.type === "EXP")) {
    entries.push({
      date: t.date, type: "EXPENSE", ref: t.accountHead?.name ?? "Expense",
      amount: t.amount, direction: "out", narration: t.narration,
    });
  }
  // Cash sales (receipts).
  for (const s of cashSales) {
    entries.push({
      date: s.date, type: "SALE", ref: s.invoiceNo,
      amount: s.paid, direction: "in", narration: "Cash sale",
    });
  }
  // Cash purchases (payments).
  for (const p of cashPurchases) {
    entries.push({
      date: p.date, type: "PURCHASE", ref: p.invoiceNo,
      amount: p.paid, direction: "out", narration: "Cash purchase",
    });
  }

  // Sort by date.
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute running balance.
  let running = openingCash;
  const withBalance = entries.map((e) => {
    running += e.direction === "in" ? e.amount : -e.amount;
    return { ...e, balance: running, balanceDisplay: formatBDT(running) };
  });

  const totalIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    period: { from, to },
    openingCash,
    closingCash: openingCash + totalIn - totalOut,
    totalIn,
    totalOut,
    entries: withBalance.map((e) => ({
      ...e,
      amountDisplay: formatBDT(e.amount),
      date: new Date(e.date).toISOString(),
    })),
  });
});
