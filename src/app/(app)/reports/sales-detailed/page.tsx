"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Printer, Receipt, Search, FileText, TrendingUp, Boxes } from "lucide-react";
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

// ── Grouped invoice shape (computed client-side from the flat API rows) ──
type GroupedInvoice = {
  invoiceNo: string;
  date: string;
  dateDisplay: string;
  customerName: string;
  salesman: string;
  mode: string;
  lines: Row[];
  invoiceTotal: number;
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

  // Group flat rows by invoiceNo — preserves the order from the API (which
  // is ordered by sale.date desc). Each invoice gets its line items + total.
  const groupedInvoices: GroupedInvoice[] = useMemo(() => {
    const map = new Map<string, GroupedInvoice>();
    for (const r of rows) {
      const existing = map.get(r.invoiceNo);
      if (existing) {
        existing.lines.push(r);
        existing.invoiceTotal += r.lineTotal;
      } else {
        map.set(r.invoiceNo, {
          invoiceNo: r.invoiceNo,
          date: r.date,
          dateDisplay: r.dateDisplay,
          customerName: r.customerName,
          salesman: r.salesman,
          mode: r.mode,
          lines: [r],
          invoiceTotal: r.lineTotal,
        });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  // Grand total across all invoices on the current page.
  const grandTotal = groupedInvoices.reduce((s, inv) => s + inv.invoiceTotal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales report (detailed)"
        description="Invoice-wise line items grouped by invoice (doc §5.3)."
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

      {/* ── Filters inside a Card (cleaner container) ── */}
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
          {/* Print-only header */}
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
              {/* ── Summary cards — compact with icons ── */}
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
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Line items</p>
                      <p className="text-lg font-bold tabular-nums leading-tight">{summary?.lineItemCount ?? 0}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total qty</p>
                      <p className="text-lg font-bold tabular-nums leading-tight">{summary?.totalQty ?? 0}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</p>
                      <p className="text-lg font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">{summary?.totalRevenueDisplay ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Grouped invoice list ─────────────────────────────────────
                  Each invoice is a Card with:
                  - Header: invoice no + date + customer + salesman + mode + invoice total
                  - Line items table: Product | Serial | Qty | Unit | Disc% | Line total
                  - Subtotal row at the bottom of each invoice card

                  Mobile: line items shown as compact list (no horizontal scroll)
                  Desktop: line items shown as a proper table inside the card */}
              <div className="space-y-4">
                {groupedInvoices.map((inv) => (
                  <Card key={inv.invoiceNo} className="overflow-hidden">
                    {/* ── Invoice header ── */}
                    <CardContent className="py-3 px-4 bg-muted/30 border-b">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{inv.invoiceNo}</span>
                            <Badge variant="outline" className="text-[10px]">{inv.mode}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {inv.dateDisplay} · {inv.customerName}
                            {inv.salesman && ` · ${inv.salesman}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoice total</p>
                          <p className="text-sm font-bold tabular-nums">{formatBDT(inv.invoiceTotal)}</p>
                        </div>
                      </div>
                    </CardContent>

                    {/* ── Line items — desktop table ── */}
                    <div className="hidden sm:block">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/20">
                          <tr>
                            <th className="text-left font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Product / Service</th>
                            <th className="text-left font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Serial</th>
                            <th className="text-right font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Qty</th>
                            <th className="text-right font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Unit</th>
                            <th className="text-right font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Disc%</th>
                            <th className="text-right font-medium px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.lines.map((r, i) => (
                            <tr key={i} className="border-t border-muted">
                              <td className="px-4 py-2">
                                {r.lineType === "SERVICE" && <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">SVC</Badge>}
                                <span className="font-medium">{r.productName}</span>
                                {r.productModel && <span className="text-xs text-muted-foreground ml-1">· {r.productModel}</span>}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.serialNo ?? "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{r.qtyDisplay}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{r.unitPriceDisplay}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.discount || 0}%</td>
                              <td className="px-4 py-2 text-right tabular-nums font-medium">{r.lineTotalDisplay}</td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Subtotal row — bottom of each invoice card */}
                        <tfoot>
                          <tr className="border-t-2 bg-muted/20">
                            <td colSpan={5} className="px-4 py-2 text-right text-[10px] text-muted-foreground uppercase tracking-wide">Subtotal</td>
                            <td className="px-4 py-2 text-right tabular-nums font-bold">{formatBDT(inv.invoiceTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* ── Line items — mobile compact list ── */}
                    <ul className="sm:hidden divide-y divide-muted">
                      {inv.lines.map((r, i) => (
                        <li key={i} className="px-4 py-2.5 space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {r.lineType === "SERVICE" && <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">SVC</Badge>}
                              <span className="text-sm font-medium">{r.productName}</span>
                              {r.productModel && <span className="text-xs text-muted-foreground ml-1 block">{r.productModel}</span>}
                            </div>
                            <span className="text-sm font-bold tabular-nums shrink-0">{r.lineTotalDisplay}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {r.serialNo ? <span className="font-mono">{r.serialNo}</span> : <span>—</span>}
                            </span>
                            <span className="tabular-nums">{r.qtyDisplay} × {r.unitPriceDisplay}{r.discount > 0 && ` · ${r.discount}% off`}</span>
                          </div>
                        </li>
                      ))}
                      {/* Subtotal row */}
                      <li className="px-4 py-2 bg-muted/20 flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Subtotal</span>
                        <span className="text-sm font-bold tabular-nums">{formatBDT(inv.invoiceTotal)}</span>
                      </li>
                    </ul>
                  </Card>
                ))}
              </div>

              {/* ── Grand total at the bottom ── */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grand total ({groupedInvoices.length} invoices)</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-primary">{formatBDT(grandTotal)}</p>
                </CardContent>
              </Card>

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
