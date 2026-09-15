"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, ReceiptText, Search } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

export default function IncomeExpenseReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [af, setAf] = useState(from);
  const [at, setAt] = useState(to);
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-ie", af, at],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/income-expense?from=${af}&to=${at}`)).json()),
    enabled: hasGenerated,
  });

  const heads = data?.heads ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Income / Expense" description="Account-head-wise summary (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`income-expense-${af}-to-${at}`, heads)} disabled={!heads.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAf(from); setAt(to); setHasGenerated(true); }} />
      {!hasGenerated ? (
        <EmptyState
          icon={ReceiptText}
          title="Income / Expense"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAf(from); setAt(to); setHasGenerated(true); }}>
              <Search className="mr-2 h-4 w-4" /> Generate report
            </Button>
          }
        />
      ) : (
        <>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total income</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.totalIncomeDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total expense</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary?.totalExpenseDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Net</p><p className={`text-xl font-bold tabular-nums ${(summary?.net ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{summary?.netDisplay ?? "—"}</p></CardContent></Card>
          </div>
          {heads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions in this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left font-medium px-3 py-2">Account head</th><th className="text-left font-medium px-3 py-2">Type</th><th className="text-right font-medium px-3 py-2">Count</th><th className="text-right font-medium px-3 py-2">Total</th></tr></thead>
                <tbody>
                  {heads.map((h: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{h.name}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={h.kind === "IN" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>{h.kind === "IN" ? "Income" : "Expense"}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums">{h.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBDT(h.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
