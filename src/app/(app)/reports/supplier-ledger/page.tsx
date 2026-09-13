"use client";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/layout/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Supplier = { id: string; name: string; phone: string | null; company: string | null; currentBalance: number };

export default function SupplierLedgerReportPage() {
  const { data } = useQuery({
    queryKey: ["suppliers-ledger-report"],
    queryFn: async () => (await (await fetch("/api/suppliers")).json()).suppliers as Supplier[],
  });
  const suppliers = data ?? [];

  const columns: ColumnDef<Supplier>[] = [
    { header: "Supplier", accessorKey: "name", cell: ({ row }) => <Link href={`/suppliers/${row.original.id}`} className="font-medium hover:underline">{row.original.name}</Link> },
    { header: "Company", accessorKey: "company", cell: ({ row }) => row.original.company ?? "—" },
    { header: "Balance", accessorKey: "currentBalance", cell: ({ row }) => <span className={`tabular-nums font-medium ${row.original.currentBalance > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(row.original.currentBalance)}</span> },
    { header: "", id: "actions", cell: ({ row }) => <Link href={`/suppliers/${row.original.id}`} className="text-primary text-sm hover:underline">View ledger →</Link> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Supplier ledger" description="Click a supplier to view their full ledger (doc §5.3)." />
      {suppliers.length === 0 ? <EmptyState icon={Truck} title="No suppliers" /> : <DataTable columns={columns} data={suppliers} maxHeight="max-h-[32rem]" />}
    </div>
  );
}
