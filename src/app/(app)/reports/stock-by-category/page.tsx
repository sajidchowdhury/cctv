"use client";

import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, Layers, ChevronDown, ChevronRight, Search } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

export default function StockByCategoryReportPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-stock-by-category"],
    queryFn: async () => await (await fetch("/cctv/api/reports/stock-by-category")).json(),
    enabled: hasGenerated,
  });

  const categories: any[] = data?.categories ?? [];
  const totals = data?.totals;

  function toggle(name: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function exportAll() {
    // Flatten: one row per product.
    const rows: any[] = [];
    for (const cat of categories) {
      for (const p of cat.products) {
        rows.push({
          category: cat.name,
          product: p.name, sku: p.sku, model: p.model ?? "",
          tracking: p.isSerialised ? "Serialised" : "Qty-based",
          onHand: p.onHand, safetyStock: p.safetyStock,
          lastCost: p.lastCost, stockValue: p.stockValue,
          lowStock: p.lowStock ? "Yes" : "No",
        });
      }
    }
    exportToCSV("stock-by-category", rows);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock by category"
        description="Stock qty + value grouped by category with drill-down to products (snapshot)."
        action={
          <div className="flex gap-2" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!categories.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={exportAll} disabled={!categories.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {!hasGenerated ? (
        <EmptyState
          icon={Layers}
          title="Stock by category"
          description="Click Generate to load the report data."
          action={
            <Button onClick={() => setHasGenerated(true)}>
              <Search className="mr-2 h-4 w-4" /> Generate report
            </Button>
          }
        />
      ) : (
        <>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Stock by Category</h1>
        <p className="text-sm">Snapshot as of {new Date().toLocaleDateString()}</p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No products found.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Categories</p><p className="text-xl font-bold tabular-nums">{totals?.categoryCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold tabular-nums">{totals?.productCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-bold tabular-nums">{totals?.totalQty ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total value</p><p className="text-xl font-bold tabular-nums">{formatBDT(totals?.totalValue ?? 0)}</p></CardContent></Card>
          </div>

          {/* Desktop table — category summary */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide w-8"></th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Category</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Products</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Total qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Stock value</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <Fragment key={cat.name}>
                    <tr className="border-t hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggle(cat.name)}>
                      <td className="px-4 py-3 text-muted-foreground">
                        {expanded.has(cat.name) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium">{cat.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{cat.productCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{cat.totalQtyDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{cat.stockValueDisplay}</td>
                    </tr>
                    {expanded.has(cat.name) && cat.products.map((p: any) => (
                      <tr key={p.id} className="border-t bg-muted/20">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 pl-8">
                          <Link href={`/products/${p.id}`} className="hover:underline">{p.name}</Link>
                          <span className="text-xs text-muted-foreground ml-2">· {p.sku}</span>
                          {!p.isSerialised && <Badge variant="outline" className="ml-2 text-xs">Qty-based</Badge>}
                          {p.lowStock && <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">Low</Badge>}
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-right tabular-nums">{p.onHand}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p.stockValueDisplay} <span className="text-xs text-muted-foreground">(@ {p.lastCostDisplay})</span></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {categories.map((cat) => (
              <li key={cat.name} className="rounded-lg border p-3 space-y-2">
                <button className="flex items-center justify-between w-full" onClick={() => toggle(cat.name)}>
                  <span className="font-medium text-sm">{cat.name}</span>
                  <span className="text-sm tabular-nums">{cat.stockValueDisplay}</span>
                </button>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{cat.productCount} products · {cat.totalQtyDisplay} units</span>
                </div>
                {expanded.has(cat.name) && (
                  <ul className="space-y-1 pt-2 border-t">
                    {cat.products.map((p: any) => (
                      <li key={p.id} className="flex justify-between text-xs">
                        <Link href={`/products/${p.id}`} className="hover:underline">{p.name}</Link>
                        <span className="tabular-nums">{p.onHand} · {p.stockValueDisplay}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}
    </div>
  );
}
