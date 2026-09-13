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
import { PackagePlus, Plus, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";

type Purchase = {
  id: string;
  invoiceNo: string;
  date: string;
  supplierName: string;
  total: number;
  paid: number;
  due: number;
  mode: string;
  itemCount: number;
};

export default function PurchasesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["purchases", search],
    queryFn: async () => {
      const r = await fetch(`/api/purchases?q=${encodeURIComponent(search)}`);
      return (await r.json()).purchases as Purchase[];
    },
  });
  const purchases = data ?? [];

  const columns = useMemo<ColumnDef<Purchase>[]>(
    () => [
      {
        header: "Invoice",
        accessorKey: "invoiceNo",
        cell: ({ row }) => (
          <Link href={`/purchases/${row.original.id}`} className="font-medium hover:underline">
            {row.original.invoiceNo}
          </Link>
        ),
      },
      { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
      { header: "Supplier", accessorKey: "supplierName" },
      { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
      { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.total)}</span> },
      {
        header: "Due",
        accessorKey: "due",
        cell: ({ row }) =>
          row.original.due > 0 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{formatBDT(row.original.due)}</Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid</Badge>
          ),
      },
      { header: "Mode", accessorKey: "mode" },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Stock-in invoices with serial capture."
        action={
          <Button asChild size="sm">
            <Link href="/purchases/new"><Plus className="mr-2 h-4 w-4" /> New purchase</Link>
          </Button>
        }
      />
      <SearchScanInput value={search} onChange={setSearch} placeholder="Search invoice number…" className="max-w-md" />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title={search ? "No matching purchases" : "No purchases yet"}
          description={search ? "Try a different search." : "Record your first stock-in to build inventory."}
          action={!search ? <Button asChild><Link href="/purchases/new"><Plus className="mr-2 h-4 w-4" /> New purchase</Link></Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={purchases} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
