"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DataTable } from "@/components/layout/data-table";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Wrench, AlertTriangle, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Ticket = { id: string; rmaNo: string; dateOpened: string; customerName: string; productName: string; productModel: string | null; supplierName: string; faultReason: string; stage: string; vendorRmaRef: string | null; vendorCharge: number; eta: string | null; closedAt: string | null; overdue: boolean };

const STAGE_TONE: Record<string, string> = {
  RECEIVED_FROM_CUSTOMER: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  SENT_TO_VENDOR: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  UNDER_REPAIR: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  RETURNED_FROM_VENDOR: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  DELIVERED_TO_CUSTOMER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default function RmaStatusReportPage() {
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
    queryKey: ["report-rma-status", page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/rma-status?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const tickets: Ticket[] = data?.rows ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Ticket>[] = [
    { header: "RMA No", accessorKey: "rmaNo" },
    { header: "Opened", accessorKey: "dateOpened", cell: ({ row }) => formatDate(row.original.dateOpened) },
    { header: "Customer", accessorKey: "customerName" },
    { header: "Product", accessorKey: "productName", cell: ({ row }) => <div><p className="font-medium">{row.original.productName}</p><p className="text-xs text-muted-foreground">{row.original.productModel ?? "—"}</p></div> },
    { header: "Vendor", accessorKey: "supplierName" },
    { header: "Stage", accessorKey: "stage", cell: ({ row }) => <Badge className={STAGE_TONE[row.original.stage] ?? ""} variant="secondary">{row.original.stage.replace(/_/g, " ")}</Badge> },
    { header: "ETA", accessorKey: "eta", cell: ({ row }) => row.original.eta ? formatDate(row.original.eta) : "—" },
    { header: "Status", cell: ({ row }) => row.original.overdue ? <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge> : row.original.closedAt ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Closed</Badge> : <Badge variant="secondary">Open</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="RMA status" description="Open RMAs by stage, vendor turnaround, overdue list (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV("rma-status", tickets)} disabled={!tickets.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RMA / customer / product…"
          className="pl-9"
        />
      </div>
      {!hasGenerated ? (
        <EmptyState
          icon={Wrench}
          title="RMA status"
          description="Click Generate to load the report data."
          action={
            <Button onClick={() => setHasGenerated(true)}>
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
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total RMAs</p><p className="text-xl font-bold tabular-nums">{summary?.total ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary?.overdueCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Stages</p><div className="flex flex-wrap gap-1 mt-1">{Object.entries(summary?.byStage ?? {}).map(([stage, count]) => <Badge key={stage} variant="outline" className="text-xs">{stage.replace(/_/g, " ")}: {count as number}</Badge>)}</div></CardContent></Card>
          </div>
          {tickets.length === 0 ? (
            <div className="text-center py-8"><Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No RMA tickets. The RMA module (S21) will populate this report.</p></div>
          ) : (
            <>
              <DataTable columns={columns} data={tickets} maxHeight="max-h-[32rem]" />
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
