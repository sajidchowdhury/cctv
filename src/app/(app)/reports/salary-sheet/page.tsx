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
import { Label } from "@/components/ui/label";
import { Download, Loader2, Briefcase, Search, Users, Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Record = { id: string; month: string; employeeName: string; employeeRole: string; basic: number; allowance: number; advanceDeduction: number; netPayable: number; paidOn: string | null };

export default function SalarySheetReportPage() {
  const [month, setMonth] = useState("");
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
    queryKey: ["report-salary-sheet", month, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(month ? { month } : {}),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/salary-sheet?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const records: Record[] = data?.rows ?? [];
  const summary = data?.summary;

  const columns: ColumnDef<Record>[] = [
    { header: "Month", accessorKey: "month" },
    { header: "Employee", accessorKey: "employeeName" },
    { header: "Role", accessorKey: "employeeRole", cell: ({ row }) => <Badge variant="outline">{row.original.employeeRole}</Badge> },
    { header: "Basic", accessorKey: "basic", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.basic)}</span> },
    { header: "Allowance", accessorKey: "allowance", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.allowance)}</span> },
    { header: "Deduct", accessorKey: "advanceDeduction", cell: ({ row }) => <span className="tabular-nums text-red-600">-{formatBDT(row.original.advanceDeduction)}</span> },
    { header: "Net", accessorKey: "netPayable", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.netPayable)}</span> },
    { header: "Status", cell: ({ row }) => row.original.paidOn ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid {formatDate(row.original.paidOn)}</Badge> : <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Pending</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Employee salary sheet" description="Monthly payroll summary (doc §5.3)." action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`salary-sheet-${month || "all"}`, records)} disabled={!records.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Filter by month (YYYY-MM)</Label>
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} placeholder="All months" />
            </div>
            <div className="relative flex-1 min-w-[12rem] sm:self-end">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee / role…"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {!hasGenerated ? (
        <EmptyState
          icon={Briefcase}
          title="Employee salary sheet"
          description="Optionally pick a month, then click Generate to load the report data."
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Records</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{summary?.count ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total net payable</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{summary?.totalNetDisplay ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
                  <p className="text-lg font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">{summary?.paidCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
                  <p className="text-lg font-bold tabular-nums leading-tight text-amber-600 dark:text-amber-400">{summary?.pendingCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          {records.length === 0 ? (
            <div className="text-center py-8"><Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No salary records. Generate payroll from Employees → Payroll.</p></div>
          ) : (
            <>
              <DataTable columns={columns} data={records} maxHeight="max-h-[32rem]" />
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
