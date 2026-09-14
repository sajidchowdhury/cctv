"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wallet, Loader2, Download, Printer } from "lucide-react";
import { formatBDT, formatDateTime } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

export default function CashBookPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);

  const { data, isLoading } = useQuery({
    queryKey: ["cash-book", appliedFrom, appliedTo],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/cash-book?from=${appliedFrom}&to=${appliedTo}`)).json()),
  });

  const cb = data;
  const entries: any[] = cb?.entries ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash book"
        description="Day-wise cash in/out with running balance + closing (doc §4.4)."
        action={
          <div className="flex gap-2" data-print-hidden>
            <Button asChild variant="outline" size="sm">
              <Link href="/ledger"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!entries.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`cash-book-${appliedFrom}-to-${appliedTo}`, entries.map((e) => ({
              date: e.date, type: e.type, reference: e.ref, narration: e.narration ?? "",
              in: e.direction === "in" ? e.amount : 0,
              out: e.direction === "out" ? e.amount : 0,
              balance: e.balance,
            })))} disabled={!entries.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div data-print-hidden>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); }} />
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Cash Book</h1>
        <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
      </div>

      {isLoading || !cb ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Opening cash</p><p className="text-xl font-bold tabular-nums">{formatBDT(cb.openingCash)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Cash in</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(cb.totalIn)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Cash out</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatBDT(cb.totalOut)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Closing cash</p><p className="text-xl font-bold tabular-nums">{formatBDT(cb.closingCash)}</p></CardContent></Card>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No cash transactions in this period.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Time</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Type</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Reference</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Narration</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">In</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Out</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDateTime(e.date)}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className={e.direction === "in" ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"}>{e.type}</Badge></td>
                        <td className="px-4 py-3 font-medium">{e.ref}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.narration ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.direction === "in" ? e.amountDisplay : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">{e.direction === "out" ? e.amountDisplay : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{e.balanceDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="sm:hidden space-y-2">
                {entries.map((e: any, i: number) => (
                  <li key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={e.direction === "in" ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400" : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"}>{e.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.date)}</span>
                    </div>
                    <p className="font-medium text-sm">{e.ref}</p>
                    {e.narration && <p className="text-xs text-muted-foreground">{e.narration}</p>}
                    <div className="flex items-center justify-between pt-1 text-sm">
                      <span className={e.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {e.direction === "in" ? "+" : "−"}{e.amountDisplay}
                      </span>
                      <span className="font-medium tabular-nums">Bal: {e.balanceDisplay}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
