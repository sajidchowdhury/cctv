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
import { Boxes, Plus, AlertTriangle, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  model: string | null;
  sku: string;
  categoryName: string | null;
  unitName: string | null;
  safetyStock: number;
  defaultPrice: number | null;
  onHand: number;
  lowStock: boolean;
};

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, lowOnly],
    queryFn: async () => {
      const url = `/api/products?q=${encodeURIComponent(search)}${lowOnly ? "&lowStock=1" : ""}`;
      const r = await fetch(url);
      return (await r.json()).products as Product[];
    },
  });

  const products = data ?? [];

  const columns = useMemo<ColumnDef<Product>[]>(
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
      { header: "On hand", accessorKey: "onHand", cell: ({ row }) => <span className="tabular-nums">{row.original.onHand}</span> },
      {
        header: "Safety",
        accessorKey: "safetyStock",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.safetyStock}</span>,
      },
      {
        header: "Price",
        accessorKey: "defaultPrice",
        cell: ({ row }) => (row.original.defaultPrice ? formatBDT(row.original.defaultPrice) : "—"),
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.lowStock ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" /> Low
            </Badge>
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
        title="Products"
        description="Catalogue of CCTV items your business trades."
        action={
          <Button asChild size="sm">
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" /> New product
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchScanInput
          value={search}
          onChange={setSearch}
          placeholder="Search product name…"
          className="flex-1"
        />
        <Button
          variant={lowOnly ? "default" : "outline"}
          onClick={() => setLowOnly((v) => !v)}
          className="sm:w-auto"
        >
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock only
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={search || lowOnly ? "No matching products" : "No products yet"}
          description={search || lowOnly ? "Try a different search or filter." : "Add your first CCTV product to start tracking inventory."}
          action={
            !search && !lowOnly ? (
              <Button asChild>
                <Link href="/products/new">
                  <Plus className="mr-2 h-4 w-4" /> Add product
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={products} maxHeight="max-h-[32rem]" />
      )}

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} · {products.filter((p) => p.lowStock).length} low-stock
        </CardContent>
      </Card>
    </div>
  );
}
