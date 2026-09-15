"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { DataTable } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, ShoppingCart, Search } from "lucide-react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["report-sales", appliedFrom, appliedTo],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/sales?from=${appliedFrom}&to=${appliedTo}`)).json()),
    enabled: hasGenerated,
  });

  const sales: Sale[] = data?.sales ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Sale>[] = [
    { header: "Invoice", accessorKey: "invoiceNo" },
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
      <PageHeader title="Sales report" description="Invoice list with totals + CSV export (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`sales-${appliedFrom}-to-${appliedTo}`, sales)} disabled={!sales.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); }} />
      {!hasGenerated ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sales report"
          description="Set a date range and click Generate to load the report data."
          action={
            <Button onClick={() => { setAppliedFrom(from); setAppliedTo(to); setHasGenerated(true); }}>
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
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total sales</p><p className="text-xl font-bold tabular-nums">{summary?.totalSalesDisplay ?? "—"} </p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total paid</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.totalPaidDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total due</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.totalDueDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold tabular-nums">{summary?.count ?? 0}</p></CardContent></Card>
          </div>
          {sales.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No sales in this period.</p> : <DataTable columns={columns} data={sales} maxHeight="max-h-[32rem]" />}
        </>
      )}
        </>
      )}
    </div>
  );
}
