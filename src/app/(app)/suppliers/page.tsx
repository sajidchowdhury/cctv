"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { Truck, Plus, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  openingBalance: number;
  currentBalance: number;
  purchaseCount: number;
};

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: async () => {
      const r = await fetch(`/api/suppliers?q=${encodeURIComponent(search)}`);
      return (await r.json()).suppliers as Supplier[];
    },
  });
  const suppliers = data ?? [];

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        header: "Supplier",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link href={`/suppliers/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { header: "Company", accessorKey: "company", cell: ({ row }) => row.original.company ?? "—" },
      { header: "Phone", accessorKey: "phone", cell: ({ row }) => row.original.phone ?? "—" },
      {
        header: "Opening",
        accessorKey: "openingBalance",
        cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.openingBalance)}</span>,
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
          if (bal > 0) return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Payable</Badge>;
          if (bal < 0) return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Advance</Badge>;
          return <Badge variant="secondary">Settled</Badge>;
        },
      },
    ],
    []
  );

  const totalPayable = suppliers.filter((s) => s.currentBalance > 0).reduce((a, s) => a + s.currentBalance, 0);
  const totalAdvance = suppliers.filter((s) => s.currentBalance < 0).reduce((a, s) => a + s.currentBalance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase CCTV stock from."
        action={
          <Button asChild size="sm">
            <Link href="/suppliers/new"><Plus className="mr-2 h-4 w-4" /> New supplier</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total payable</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatBDT(totalPayable)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total advance</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(-totalAdvance)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Suppliers</p><p className="text-xl font-bold tabular-nums">{suppliers.length}</p></CardContent></Card>
      </div>

      <SearchScanInput value={search} onChange={setSearch} placeholder="Search name / company / phone…" className="max-w-md" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? "No matching suppliers" : "No suppliers yet"}
          description={search ? "Try a different search." : "Add your first supplier to start purchasing stock."}
          action={!search ? (
            <Button asChild><Link href="/suppliers/new"><Plus className="mr-2 h-4 w-4" /> Add supplier</Link></Button>
          ) : undefined}
        />
      ) : (
        <DataTable columns={columns} data={suppliers} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
