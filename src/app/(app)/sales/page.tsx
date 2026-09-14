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
import { ShoppingCart, Plus, Loader2, Pause, RotateCcw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";

type Sale = {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  total: number;
  paid: number;
  due: number;
  mode: string;
  isHeld: boolean;
  quotationId: string | null;
  itemCount: number;
};

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [heldOnly, setHeldOnly] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["sales", search, heldOnly],
    queryFn: async () => {
      const url = `/cctv/api/sales?q=${encodeURIComponent(search)}${heldOnly ? "&held=1" : ""}`;
      return (await (await fetch(url)).json()).sales as Sale[];
    },
  });
  const sales = data ?? [];

  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        header: "Invoice",
        accessorKey: "invoiceNo",
        cell: ({ row }) => (
          <Link href={`/sales/${row.original.id}`} className="font-medium hover:underline">
            {row.original.invoiceNo}
          </Link>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.isHeld ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Pause className="h-3 w-3 mr-1" /> Held</Badge>
          ) : row.original.quotationId ? (
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">From Quote</Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Final</Badge>
          ),
      },
      { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
      { header: "Customer", accessorKey: "customerName" },
      { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
      { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.total)}</span> },
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
      {
        header: "",
        id: "actions",
        cell: ({ row }) =>
          row.original.isHeld ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/sales/new?resume=${row.original.id}`}>
                <RotateCcw className="mr-1 h-3 w-3" /> Resume
              </Link>
            </Button>
          ) : null,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Cart-based invoicing with live stock + due ledger."
        action={
          <Button asChild size="sm">
            <Link href="/sales/new"><Plus className="mr-2 h-4 w-4" /> New sale</Link>
          </Button>
        }
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchScanInput value={search} onChange={setSearch} placeholder="Search invoice number…" className="flex-1" />
        <Button variant={heldOnly ? "default" : "outline"} onClick={() => setHeldOnly((v) => !v)}>
          <Pause className="mr-2 h-4 w-4" /> Held only
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={search || heldOnly ? "No matching sales" : "No sales yet"}
          description={search || heldOnly ? "Try a different search." : "Record your first sale to start tracking revenue."}
          action={!search && !heldOnly ? <Button asChild><Link href="/sales/new"><Plus className="mr-2 h-4 w-4" /> New sale</Link></Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={sales} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
