"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { Users, Plus, Loader2, Briefcase } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";

type Employee = {
  id: string; name: string; phone: string | null; role: string;
  salary: number; joinDate: string; status: string;
  lastSalary: { month: string; netPayable: number; paidOn: string | null } | null;
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: async () => (await (await fetch(`/api/employees?q=${encodeURIComponent(search)}`)).json()).employees as Employee[],
  });
  const employees = data ?? [];

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        header: "Employee",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link href={`/employees/${row.original.id}`} className="font-medium hover:underline">{row.original.name}</Link>
        ),
      },
      { header: "Phone", accessorKey: "phone", cell: ({ row }) => row.original.phone ?? "—" },
      { header: "Role", accessorKey: "role", cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge> },
      { header: "Salary", accessorKey: "salary", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.salary)}</span> },
      { header: "Joined", accessorKey: "joinDate", cell: ({ row }) => formatDate(row.original.joinDate) },
      {
        header: "Last salary",
        cell: ({ row }) =>
          row.original.lastSalary ? (
            <Badge variant={row.original.lastSalary.paidOn ? "secondary" : "outline"}
              className={row.original.lastSalary.paidOn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}>
              {row.original.lastSalary.month} {row.original.lastSalary.paidOn ? "✓" : "pending"}
            </Badge>
          ) : "—",
      },
      { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge variant={row.original.status === "ACTIVE" ? "secondary" : "outline"} className={row.original.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}>{row.original.status}</Badge> },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Staff master + monthly payroll (doc §4.6)."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/payroll/new"><Briefcase className="mr-2 h-4 w-4" /> Payroll</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/employees/new"><Plus className="mr-2 h-4 w-4" /> New</Link>
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : employees.length === 0 ? (
        <EmptyState icon={Users} title={search ? "No matching employees" : "No employees yet"} description={search ? "Try a different search." : "Add your first staff member."} action={!search ? <Button asChild><Link href="/employees/new"><Plus className="mr-2 h-4 w-4" /> Add employee</Link></Button> : undefined} />
      ) : (
        <DataTable columns={columns} data={employees} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
