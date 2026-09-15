"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { DataTable } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Briefcase, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Record = { id: string; month: string; employeeName: string; employeeRole: string; basic: number; allowance: number; advanceDeduction: number; netPayable: number; paidOn: string | null };

export default function SalarySheetReportPage() {
  const [month, setMonth] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["report-salary-sheet", month],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/salary-sheet${month ? `?month=${month}` : ""}`)).json()),
    enabled: hasGenerated,
  });

  const records: Record[] = data?.records ?? [];
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
      <div className="space-y-1 max-w-xs">
        <Label className="text-xs">Filter by month (YYYY-MM)</Label>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="All months" />
      </div>
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
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Records</p><p className="text-xl font-bold tabular-nums">{summary?.count ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total net payable</p><p className="text-xl font-bold tabular-nums">{summary?.totalNetDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.paidCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.pendingCount ?? 0}</p></CardContent></Card>
          </div>
          {records.length === 0 ? (
            <div className="text-center py-8"><Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No salary records. Generate payroll from Employees → Payroll.</p></div>
          ) : (
            <DataTable columns={columns} data={records} maxHeight="max-h-[32rem]" />
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
