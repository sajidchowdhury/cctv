"use client";

import { useState, Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, Printer, Layers, ChevronDown, ChevronRight, Search, Filter, X } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

export default function StockByCategoryReportPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  // Phase E: category filter — user can pick specific categories to view.
  // Empty set = show all categories. Non-empty = show only selected.
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  // Phase 5 / Feature #2: search input for the category filter panel so the
  // user can find a category by name when the list is long.
  const [categorySearch, setCategorySearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-stock-by-category"],
    queryFn: async () => await (await fetch("/cctv/api/reports/stock-by-category")).json(),
    enabled: hasGenerated,
  });

  const allCategories: any[] = data?.categories ?? [];

  // Phase 5 / Feature #2: filter the category list shown in the Filter panel
  // by the search term. Empty search = show all categories. Non-empty = filter
  // by name (case-insensitive).
  const filteredCategoryList = useMemo(() => {
    if (!categorySearch.trim()) return allCategories;
    const q = categorySearch.toLowerCase();
    return allCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCategories, categorySearch]);

  // Phase E: filter categories based on selection.
  const categories = useMemo(() => {
    if (selectedCategories.size === 0) return allCategories;
    return allCategories.filter((c) => selectedCategories.has(c.name));
  }, [allCategories, selectedCategories]);

  // Compute filtered totals (so summary cards reflect the filter, not all data).
  const filteredTotals = useMemo(() => {
    const productCount = categories.reduce((s, c) => s + (c.productCount ?? 0), 0);
    const totalQty = categories.reduce((s, c) => s + (c.totalQty ?? 0), 0);
    const totalValue = categories.reduce((s, c) => s + (c.stockValue ?? 0), 0);
    return { categoryCount: categories.length, productCount, totalQty, totalValue };
  }, [categories]);

  function toggle(name: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleCategoryFilter(name: string) {
    setSelectedCategories((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearCategoryFilter() {
    setSelectedCategories(new Set());
  }

  function selectAllCategories() {
    setSelectedCategories(new Set(allCategories.map((c) => c.name)));
  }

  function exportAll() {
    // Export only the filtered categories.
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
            {hasGenerated && allCategories.length > 0 && (
              <Button
                variant={selectedCategories.size > 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterOpen((o) => !o)}
              >
                <Filter className="mr-2 h-4 w-4" /> Filter
                {selectedCategories.size > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">{selectedCategories.size}</Badge>
                )}
              </Button>
            )}
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

      {/* Phase E: category filter panel — multi-select checkboxes */}
      {filterOpen && allCategories.length > 0 && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filter by category</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllCategories}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={clearCategoryFilter}>Clear</Button>
                <Button variant="ghost" size="sm" onClick={() => setFilterOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedCategories.size === 0
                ? "Showing all categories. Click categories below to filter."
                : `Showing ${selectedCategories.size} of ${allCategories.length} categories.`}
            </p>
            {/* Phase 5 / Feature #2: search input at the top of the filter panel
                so the user can find a category by name when the list is long. */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search category name…"
                className="pl-9 h-9"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ScrollArea className="h-48 rounded-md border p-2">
              <div className="space-y-1">
                {filteredCategoryList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No categories match &quot;{categorySearch}&quot;.
                  </p>
                ) : filteredCategoryList.map((cat) => (
                  <label
                    key={cat.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(cat.name)}
                      onChange={() => toggleCategoryFilter(cat.name)}
                      className="rounded"
                    />
                    <span className="flex-1">{cat.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{cat.productCount} products</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {selectedCategories.size > 0
              ? "No categories match the current filter."
              : "No products found."}
          </p>
          {selectedCategories.size > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={clearCategoryFilter}>
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Categories</p><p className="text-xl font-bold tabular-nums">{filteredTotals.categoryCount}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold tabular-nums">{filteredTotals.productCount}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-bold tabular-nums">{filteredTotals.totalQty}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total value</p><p className="text-xl font-bold tabular-nums">{formatBDT(filteredTotals.totalValue)}</p></CardContent></Card>
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
                          {/* Phase 5 / Feature #3: plain text, no link to /products/[id] */}
                          <span className="font-medium">{p.name}</span>
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
                        {/* Phase 5 / Feature #3: plain text, no link to /products/[id] */}
                        <span className="font-medium">{p.name}</span>
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
