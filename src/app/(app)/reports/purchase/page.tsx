"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { DataTable } from "@/components/layout/data-table";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Loader2, PackagePlus, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Purchase = { id: string; invoiceNo: string; date: string; supplierName: string; total: number; paid: number; due: number; mode: string; itemCount: number };

export default function PurchaseReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [af, setAf] = useState(from);
  const [at, setAt] = useState(to);
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
    queryKey: ["report-purchase", af, at, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: af,
        to: at,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/purchase?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const purchases: Purchase[] = data?.rows ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Purchase>[] = [
    { header: "Invoice", accessorKey: "invoiceNo" },
    { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
    { header: "Supplier", accessorKey: "supplierName" },
    { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
    { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.total)}</span> },
    { header: "Paid", accessorKey: "paid", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.paid)}</span> },
    { header: "Due", accessorKey: "due", cell: ({ row }) => row.original.due > 0 ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{formatBDT(row.original.due)}</Badge> : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid</Badge> },
    { header: "Mode", accessorKey: "mode" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase report" description="Invoice list with totals + CSV export (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`purchase-${af}-to-${at}`, purchases)} disabled={!purchases.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <div className="flex flex-col sm:flex-row gap-3">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAf(from); setAt(to); setHasGenerated(true); setPage(1); }} />
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice / supplier…"
            className="pl-9"
          />
        </div>
      </div>
      {!hasGenerated ? (
        <EmptyState
          icon={PackagePlus}
          title="Purchase report"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAf(from); setAt(to); setHasGenerated(true); setPage(1); }}>
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
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total purchase</p><p className="text-xl font-bold tabular-nums">{summary?.totalPurchaseDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total paid</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.totalPaidDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total due</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.totalDueDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold tabular-nums">{summary?.count ?? 0}</p></CardContent></Card>
          </div>
          {purchases.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No purchases in this period.</p> : <>
            <DataTable columns={columns} data={purchases} maxHeight="max-h-[32rem]" />
            <ReportPagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? pageSize}
              total={data?.total ?? 0}
              onChange={({ page: p, pageSize: ps }: PaginationState) => { setPage(p); setPageSize(ps); }}
            />
          </>}
        </>
      )}
        </>
      )}
    </div>
  );
}
