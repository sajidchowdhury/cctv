"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { DataTable } from "@/components/layout/data-table";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Loader2, ShoppingCart, Search, TrendingUp, Wallet, AlertCircle, FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Sale = { id: string; invoiceNo: string; date: string; customerName: string; salesman: string; total: number; paid: number; due: number; mode: string; itemCount: number };

export default function SalesReportPage() {
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
    queryKey: ["report-sales", appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/sales?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const sales: Sale[] = data?.rows ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Sale>[] = [
    {
      header: "Invoice",
      accessorKey: "invoiceNo",
      cell: ({ row }) => (
        <Link href={`/sales/${row.original.id}`} className="font-medium hover:underline">
          {row.original.invoiceNo}
        </Link>
      ),
    },
    { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
    { header: "Customer", accessorKey: "customerName" },
    { header: "Salesman", accessorKey: "salesman" },
    { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
    { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.total)}</span> },
    { header: "Paid", accessorKey: "paid", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.paid)}</span> },
    { header: "Due", accessorKey: "due", cell: ({ row }) => row.original.due > 0 ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{formatBDT(row.original.due)}</Badge> : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid</Badge> },
    { header: "Mode", accessorKey: "mode" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales report"
        description="Invoice list with totals + CSV export (doc §5.3)."
        action={
          <Button variant="outline" size="sm" onClick={() => exportToCSV(`sales-${appliedFrom}-to-${appliedTo}`, sales)} disabled={!sales.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* ── Filters inside a Card (cleaner container than floating inputs) ──
          Stacks to single column on mobile; horizontal on sm+. */}
      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); setPage(1); }} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / customer / salesman…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {!hasGenerated ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sales report"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); setPage(1); }}>
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
              {/* ── Summary cards — 2-col on mobile, 4-col on sm+. Compact with icons. ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoices</p>
                      <p className="text-lg font-bold tabular-nums leading-tight">{summary?.count ?? 0}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total sales</p>
                      <p className="text-lg font-bold tabular-nums leading-tight">{summary?.totalSalesDisplay ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
                      <p className="text-lg font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">{summary?.totalPaidDisplay ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due</p>
                      <p className="text-lg font-bold tabular-nums leading-tight text-amber-600 dark:text-amber-400">{summary?.totalDueDisplay ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No sales in this period.</p>
              ) : (
                <>
                  <DataTable columns={columns} data={sales} maxHeight="max-h-[32rem]" />
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
        </>
      )}
    </div>
  );
}
