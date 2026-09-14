"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { Boxes, AlertTriangle, Loader2, PackagePlus, ScanLine, Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  sku: string;
  model: string | null;
  categoryName: string | null;
  unitName: string | null;
  isSerialised: boolean; // F1-S2
  onHand: number;
  safetyStock: number;
  lastCost: number;
  stockValue: number;
  lowStock: boolean;
  deficit: number;
};

export default function StockPage() {
  const [lowOnly, setLowOnly] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["stock-summary", lowOnly],
    queryFn: async () => {
      const r = await fetch(`/cctv/api/reports/stock-summary${lowOnly ? "?lowStock=1" : ""}`);
      return await r.json();
    },
  });
  const rows: Row[] = data?.rows ?? [];
  const totals = data?.totals;

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        header: "Product",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link href={`/products/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { header: "SKU", accessorKey: "sku", cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
      { header: "Category", accessorKey: "categoryName", cell: ({ row }) => row.original.categoryName ?? "—" },
      {
        header: "Tracking",
        id: "tracking",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.isSerialised ? (
              <><ScanLine className="h-3 w-3 mr-1" /> Serialised</>
            ) : (
              <><Package className="h-3 w-3 mr-1" /> Qty-based</>
            )}
          </Badge>
        ),
      },
      { header: "On hand", accessorKey: "onHand", cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.onHand}</span> },
      { header: "Safety", accessorKey: "safetyStock", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.safetyStock}</span> },
      { header: "Last cost", accessorKey: "lastCost", cell: ({ row }) => (row.original.lastCost ? formatBDT(row.original.lastCost) : "—") },
      { header: "Value", accessorKey: "stockValue", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.stockValue)}</span> },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.lowStock ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" /> Low ({row.original.deficit} to restock)
            </Badge>
          ) : row.original.onHand === 0 ? (
            <Badge variant="secondary">Out</Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</Badge>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock summary"
        description="Product-wise on-hand quantity, value, and low-stock flags."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/purchases/new"><PackagePlus className="mr-2 h-4 w-4" /> Restock</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold tabular-nums">{totals?.productCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-bold tabular-nums">{totals?.totalUnits ?? 0}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Stock value</p><p className="text-xl font-bold tabular-nums">{formatBDT(totals?.totalValue ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Low-stock</p><p className={`text-xl font-bold tabular-nums ${(totals?.lowStockCount ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{totals?.lowStockCount ?? 0}</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock only
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No stock data" description="Add products and record purchases to see stock here." />
      ) : (
        <DataTable columns={columns} data={rows} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
