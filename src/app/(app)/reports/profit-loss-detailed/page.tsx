"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Printer, Coins, TrendingUp, TrendingDown, Search, FileText } from "lucide-react";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Debounce search input — 300ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-profit-loss-detailed", appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/profit-loss-detailed?${params}`)).json();
    },
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

      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); setPage(1); }} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / customer / product / serial…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {!hasGenerated ? (
        <EmptyState
          icon={Coins}
          title="Profit / Loss (detailed)"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); setPage(1); }}>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoices</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{summary?.invoiceCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{summary?.totalRevenueDisplay ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <Coins className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cost</p>
                  <p className="text-lg font-bold tabular-nums leading-tight text-amber-600 dark:text-amber-400">{summary?.totalCostDisplay ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${isProfit ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                  {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net profit · {summary?.marginDisplay ?? "0%"}</p>
                  <p className={`text-lg font-bold tabular-nums leading-tight ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{summary?.totalProfitDisplay ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
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
          <ReportPagination
            page={data?.page ?? 1}
            pageSize={data?.pageSize ?? pageSize}
            total={data?.total ?? 0}
            onChange={({ page: p, pageSize: ps }: PaginationState) => { setPage(p); setPageSize(ps); }}
          />
        </>
      )}
        </>
      )}
    </div>
  );
}
