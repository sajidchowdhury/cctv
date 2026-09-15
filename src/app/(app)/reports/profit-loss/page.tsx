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
import { Download, Loader2, TrendingUp, TrendingDown, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Row = { id: string; invoiceNo: string; date: string; customerName: string; revenue: number; cost: number; discount: number; profit: number; margin: number };

export default function ProfitLossReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [af, setAf] = useState(from);
  const [at, setAt] = useState(to);
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-pl", af, at],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/profit-loss?from=${af}&to=${at}`)).json()),
    enabled: hasGenerated,
  });

  const rows: Row[] = data?.rows ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Row>[] = [
    { header: "Invoice", accessorKey: "invoiceNo" },
    { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
    { header: "Customer", accessorKey: "customerName" },
    { header: "Revenue", accessorKey: "revenue", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.revenue)}</span> },
    { header: "Cost", accessorKey: "cost", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatBDT(row.original.cost)}</span> },
    { header: "Discount", accessorKey: "discount", cell: ({ row }) => <span className="tabular-nums">-{formatBDT(row.original.discount)}</span> },
    { header: "Profit", accessorKey: "profit", cell: ({ row }) => <span className={`tabular-nums font-medium ${row.original.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatBDT(row.original.profit)}</span> },
    { header: "Margin", accessorKey: "margin", cell: ({ row }) => <Badge variant="outline" className={row.original.margin >= 0 ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>{row.original.margin.toFixed(1)}%</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profit / Loss" description="Per invoice & aggregate: revenue − cost − discount (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`profit-loss-${af}-to-${at}`, rows)} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAf(from); setAt(to); setHasGenerated(true); }} />
      {!hasGenerated ? (
        <EmptyState
          icon={TrendingUp}
          title="Profit / Loss"
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
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total revenue</p><p className="text-xl font-bold tabular-nums">{summary?.totalRevenueDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total cost</p><p className="text-xl font-bold tabular-nums text-muted-foreground">{summary?.totalCostDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Net profit</p>
              <p className={`text-xl font-bold tabular-nums ${(summary?.totalProfit ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {(summary?.totalProfit ?? 0) >= 0 ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                {summary?.totalProfitDisplay ?? "—"}
              </p>
            </CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Margin</p><p className="text-xl font-bold tabular-nums">{(summary?.margin ?? 0).toFixed(1)}%</p></CardContent></Card>
          </div>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No sales in this period.</p> : <DataTable columns={columns} data={rows} maxHeight="max-h-[32rem]" />}
        </>
      )}
        </>
      )}
    </div>
  );
}
