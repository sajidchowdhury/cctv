"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, Coins, TrendingUp, TrendingDown, Search } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Row = {
  invoiceNo: string; date: string; dateDisplay: string;
  customerName: string;
  lineType: string; productName: string; productSku: string | null;
  serialNo: string | null;
  qty: number; unitPrice: number; discount: number;
  costPerUnit: number; lineRevenue: number; lineCost: number;
  lineProfit: number; margin: number;
  qtyDisplay: string; unitPriceDisplay: string; costPerUnitDisplay: string;
  lineRevenueDisplay: string; lineCostDisplay: string;
  lineProfitDisplay: string; marginDisplay: string;
};

export default function ProfitLossDetailedReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-profit-loss-detailed", appliedFrom, appliedTo],
    queryFn: async () => await (await fetch(`/cctv/api/reports/profit-loss-detailed?from=${appliedFrom}&to=${appliedTo}`)).json(),
    enabled: hasGenerated,
  });

  const rows: Row[] = data?.rows ?? [];
  const summary = data?.summary;
  const isProfit = (summary?.totalProfit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit / Loss (detailed)"
        description="Per-item cost breakdown + margin per serial (doc §5.3)."
        action={
          <div className="flex gap-2" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!rows.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`profit-loss-detailed-${appliedFrom}-to-${appliedTo}`, rows.map((r) => ({
              invoiceNo: r.invoiceNo, date: r.dateDisplay, customer: r.customerName,
              lineType: r.lineType, product: r.productName, sku: r.productSku ?? "",
              serialNo: r.serialNo ?? "", qty: r.qty, unitPrice: r.unitPrice,
              discount: r.discount, costPerUnit: r.costPerUnit,
              lineRevenue: r.lineRevenue, lineCost: r.lineCost,
              lineProfit: r.lineProfit, margin: r.marginDisplay,
            })))} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div data-print-hidden>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); }} />
      </div>

      {!hasGenerated ? (
        <EmptyState
          icon={Coins}
          title="Profit / Loss (detailed)"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); }}>
              <Search className="mr-2 h-4 w-4" /> Generate report
            </Button>
          }
        />
      ) : (
        <>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Profit / Loss (Detailed)</h1>
        <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <Coins className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sales in this period.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold tabular-nums">{summary?.invoiceCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold tabular-nums">{summary?.totalRevenueDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Cost</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.totalCostDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Net profit · {summary?.marginDisplay ?? "0%"}</p>
              <p className={`text-xl font-bold tabular-nums ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {isProfit ? <TrendingUp className="inline h-5 w-5 mr-1" /> : <TrendingDown className="inline h-5 w-5 mr-1" />}
                {summary?.totalProfitDisplay ?? "—"}
              </p>
            </CardContent></Card>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Invoice</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Serial</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Unit price</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Cost/unit</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Revenue</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Cost</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Profit</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const profitable = r.lineProfit >= 0;
                  return (
                    <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.invoiceNo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{r.dateDisplay}</td>
                      <td className="px-4 py-3">{r.customerName}</td>
                      <td className="px-4 py-3">
                        {r.lineType === "SERVICE" && <Badge variant="outline" className="mr-2 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">SVC</Badge>}
                        {r.productName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.serialNo ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.qtyDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.unitPriceDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.costPerUnitDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.lineRevenueDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.lineCostDisplay}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${profitable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{r.lineProfitDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Badge variant="outline" className={profitable ? "text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" : "text-xs bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-900"}>
                          {r.marginDisplay}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {rows.map((r, i) => {
              const profitable = r.lineProfit >= 0;
              return (
                <li key={i} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{r.invoiceNo}</span>
                    <span className="text-xs text-muted-foreground">{r.dateDisplay}</span>
                  </div>
                  <p className="text-sm">{r.customerName}</p>
                  <p className="text-xs text-muted-foreground">{r.productName}{r.serialNo ? ` · ${r.serialNo}` : ""}</p>
                  <div className="grid grid-cols-2 gap-1 pt-1 text-xs">
                    <span className="text-muted-foreground">Rev: <span className="text-foreground">{r.lineRevenueDisplay}</span></span>
                    <span className="text-muted-foreground text-right">Cost: <span className="text-amber-600 dark:text-amber-400">{r.lineCostDisplay}</span></span>
                    <span className={`font-medium ${profitable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>Profit: {r.lineProfitDisplay}</span>
                    <span className="font-medium text-right">{r.marginDisplay}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
        </>
      )}
    </div>
  );
}
