"use client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/layout/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Record = { id: string; month: string; employeeName: string; employeeRole: string; basic: number; allowance: number; advanceDeduction: number; netPayable: number; paidOn: string | null };

export default function SalarySheetReportPage() {
  const { data } = useQuery({
    queryKey: ["salary-sheet-report"],
    queryFn: async () => (await (await fetch("/api/salary-records")).json()).salaryRecords as Record[],
  });
  const records = data ?? [];

  const columns: ColumnDef<Record>[] = [
    { header: "Month", accessorKey: "month" },
    { header: "Employee", accessorKey: "employeeName" },
    { header: "Role", accessorKey: "employeeRole" },
    { header: "Basic", accessorKey: "basic", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.basic)}</span> },
    { header: "Allowance", accessorKey: "allowance", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.allowance)}</span> },
    { header: "Deduct", accessorKey: "advanceDeduction", cell: ({ row }) => <span className="tabular-nums">-{formatBDT(row.original.advanceDeduction)}</span> },
    { header: "Net", accessorKey: "netPayable", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.netPayable)}</span> },
    { header: "Status", cell: ({ row }) => row.original.paidOn ? <span className="text-xs text-emerald-600">Paid</span> : <span className="text-xs text-amber-600">Pending</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Employee salary sheet" description="Monthly payroll summary (doc §5.3)." />
      {records.length === 0 ? <EmptyState icon={Briefcase} title="No salary records" description="Generate payroll from the Employees → Payroll page." /> : <DataTable columns={columns} data={records} maxHeight="max-h-[32rem]" />}
    </div>
  );
}
