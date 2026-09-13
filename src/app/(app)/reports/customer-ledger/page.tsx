"use client";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/layout/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Customer = { id: string; name: string; phone: string | null; type: string; currentBalance: number };

export default function CustomerLedgerReportPage() {
  const { data } = useQuery({
    queryKey: ["customers-ledger-report"],
    queryFn: async () => (await (await fetch("/api/customers")).json()).customers as Customer[],
  });
  const customers = data ?? [];

  const columns: ColumnDef<Customer>[] = [
    { header: "Customer", accessorKey: "name", cell: ({ row }) => <Link href={`/customers/${row.original.id}`} className="font-medium hover:underline">{row.original.name}</Link> },
    { header: "Phone", accessorKey: "phone", cell: ({ row }) => row.original.phone ?? "—" },
    { header: "Balance", accessorKey: "currentBalance", cell: ({ row }) => <span className={`tabular-nums font-medium ${row.original.currentBalance > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(row.original.currentBalance)}</span> },
    { header: "", id: "actions", cell: ({ row }) => <Link href={`/customers/${row.original.id}`} className="text-primary text-sm hover:underline">View ledger →</Link> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customer ledger" description="Click a customer to view their full ledger (doc §5.3)." />
      {customers.length === 0 ? <EmptyState icon={Users} title="No customers" /> : <DataTable columns={columns} data={customers} maxHeight="max-h-[32rem]" />}
    </div>
  );
}
