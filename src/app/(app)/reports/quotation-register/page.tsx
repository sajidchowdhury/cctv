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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Loader2, FileText, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Quote = { id: string; quoteNo: string; date: string; customerName: string; projectType: string; total: number; status: string; itemCount: number; lossReason: string | null };

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONVERTED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export default function QuotationRegisterReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [af, setAf] = useState(from);
  const [at, setAt] = useState(to);
  const [status, setStatus] = useState("ALL");
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-quote-register", af, at, status],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/quotation-register?from=${af}&to=${at}${status !== "ALL" ? `&status=${status}` : ""}`)).json()),
    enabled: hasGenerated,
  });

  const quotes: Quote[] = data?.quotes ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Quote>[] = [
    { header: "Quote", accessorKey: "quoteNo" },
    { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
    { header: "Customer", accessorKey: "customerName" },
    { header: "Type", accessorKey: "projectType" },
    { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
    { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.total)}</span> },
    { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge className={STATUS_TONE[row.original.status] ?? ""} variant="secondary">{row.original.status}</Badge> },
    { header: "Loss reason", accessorKey: "lossReason", cell: ({ row }) => row.original.lossReason ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Quotation register" description="All quotes by status + win/loss + conversion rate (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`quotation-register-${af}-to-${at}`, quotes)} disabled={!quotes.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <div className="flex flex-col sm:flex-row gap-4">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAf(from); setAt(to); setHasGenerated(true); }} />
        <div className="space-y-1">
          <Label className="text-xs">Status filter</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CONVERTED">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {!hasGenerated ? (
        <EmptyState
          icon={FileText}
          title="Quotation register"
          description="Set a date range (and optionally a status), then click Generate to load the report data."
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
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total quotes</p><p className="text-xl font-bold tabular-nums">{summary?.total ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Conversion rate</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{(summary?.conversionRate ?? 0).toFixed(1)}%</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total value</p><p className="text-xl font-bold tabular-nums">{summary?.totalValueDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Avg quote</p><p className="text-xl font-bold tabular-nums">{summary ? formatBDT(summary.avgQuoteValue) : "—"}</p></CardContent></Card>
          </div>
          {quotes.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No quotes in this period.</p> : <DataTable columns={columns} data={quotes} maxHeight="max-h-[32rem]" />}
        </>
      )}
        </>
      )}
    </div>
  );
}
