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
import { Download, Loader2, Printer, Receipt, Search } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Row = {
  invoiceNo: string; date: string; dateDisplay: string;
  customerName: string; salesman: string;
  lineType: string; productName: string;
  productSku: string | null; productModel: string | null;
  serialNo: string | null;
  qty: number; unitPrice: number; discount: number; lineTotal: number;
  mode: string;
  qtyDisplay: string; unitPriceDisplay: string; lineTotalDisplay: string;
};

export default function SalesDetailedReportPage() {
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
    queryKey: ["report-sales-detailed", appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/sales-detailed?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const rows: Row[] = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales report (detailed)"
        description="Invoice-wise line items: product, serial, qty, price, discount (doc §5.3)."
        action={
          <div className="flex gap-2" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!rows.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`sales-detailed-${appliedFrom}-to-${appliedTo}`, rows.map((r) => ({
              invoiceNo: r.invoiceNo, date: r.dateDisplay, customer: r.customerName, salesman: r.salesman,
              lineType: r.lineType, product: r.productName, sku: r.productSku ?? "", model: r.productModel ?? "",
              serialNo: r.serialNo ?? "", qty: r.qty, unitPrice: r.unitPrice, discount: r.discount,
              lineTotal: r.lineTotal, mode: r.mode,
            })))} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div data-print-hidden>
        <div className="flex flex-col sm:flex-row gap-3">
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); setPage(1); }} />
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / customer / product / serial…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {!hasGenerated ? (
        <EmptyState
          icon={Receipt}
          title="Sales report (detailed)"
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
        <h1 className="text-xl font-bold">Sales Report (Detailed)</h1>
        <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sales in this period.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold tabular-nums">{summary?.invoiceCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Line items</p><p className="text-xl font-bold tabular-nums">{summary?.lineItemCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total qty</p><p className="text-xl font-bold tabular-nums">{summary?.totalQty ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total revenue</p><p className="text-xl font-bold tabular-nums">{summary?.totalRevenueDisplay ?? "—"}</p></CardContent></Card>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Invoice</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product / Service</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Serial</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Unit</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Disc%</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Total</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Mode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.invoiceNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{r.dateDisplay}</td>
                    <td className="px-4 py-3">{r.customerName}</td>
                    <td className="px-4 py-3">
                      {r.lineType === "SERVICE" && <Badge variant="outline" className="mr-2 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">SVC</Badge>}
                      {r.productName}
                      {r.productModel && <span className="text-xs text-muted-foreground ml-1">· {r.productModel}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.serialNo ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.qtyDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.unitPriceDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.discount || 0}%</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{r.lineTotalDisplay}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{r.mode}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{r.invoiceNo}</span>
                  <span className="text-xs text-muted-foreground">{r.dateDisplay}</span>
                </div>
                <p className="text-sm">{r.customerName}</p>
                <p className="text-xs text-muted-foreground">{r.productName}{r.serialNo ? ` · ${r.serialNo}` : ""}</p>
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span>{r.qtyDisplay} × {r.unitPriceDisplay}</span>
                  <span className="font-medium tabular-nums">{r.lineTotalDisplay}</span>
                </div>
              </li>
            ))}
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
