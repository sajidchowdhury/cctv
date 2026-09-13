"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { Users, Plus, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  currentBalance: number;
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => (await (await fetch(`/api/customers?q=${encodeURIComponent(search)}`)).json()).customers as Customer[],
  });
  const customers = data ?? [];

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        header: "Customer",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link href={`/customers/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { header: "Phone", accessorKey: "phone", cell: ({ row }) => row.original.phone ?? "—" },
      {
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
      },
      {
        header: "Balance",
        accessorKey: "currentBalance",
        cell: ({ row }) => {
          const bal = row.original.currentBalance;
          return (
            <span className={`tabular-nums font-medium ${bal > 0 ? "text-amber-600 dark:text-amber-400" : bal < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              {formatBDT(bal)}
            </span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const bal = row.original.currentBalance;
          if (bal > 0) return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Receivable</Badge>;
          if (bal < 0) return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Advance</Badge>;
          return <Badge variant="secondary">Settled</Badge>;
        },
      },
    ],
    []
  );

  const totalReceivable = customers.filter((c) => c.currentBalance > 0).reduce((a, c) => a + c.currentBalance, 0);
  const totalAdvance = customers.filter((c) => c.currentBalance < 0).reduce((a, c) => a + c.currentBalance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Buyers with receivable balances + sales attribution."
        action={
          <Button asChild size="sm">
            <Link href="/customers/new"><Plus className="mr-2 h-4 w-4" /> New customer</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Total receivable</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatBDT(totalReceivable)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Total advance</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(-totalAdvance)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Customers</p><p className="text-xl font-bold tabular-nums">{customers.length}</p></div>
      </div>
      <SearchScanInput value={search} onChange={setSearch} placeholder="Search name / phone…" className="max-w-md" />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matching customers" : "No customers yet"}
          description={search ? "Try a different search." : "Add your first customer to start tracking receivables."}
          action={!search ? <Button asChild><Link href="/customers/new"><Plus className="mr-2 h-4 w-4" /> Add customer</Link></Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={customers} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
