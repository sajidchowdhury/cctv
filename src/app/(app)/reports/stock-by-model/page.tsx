"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, Printer, ListTree, ChevronDown, ChevronRight, ArrowLeft, Search, Filter, X } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

export default function StockByModelReportPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  // Phase E: model filter — user can pick specific models to view.
  // Empty set = show all models. Non-empty = show only selected.
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-stock-by-model"],
    queryFn: async () => await (await fetch("/cctv/api/reports/stock-by-model")).json(),
    enabled: hasGenerated,
  });

  // Drill-down serials — separate query when a model is selected.
  const { data: serialData, isLoading: serialsLoading } = useQuery({
    queryKey: ["report-stock-by-model-serials", selectedModel],
    queryFn: async () => {
      if (!selectedModel) return null;
      return await (await fetch(`/cctv/api/reports/stock-by-model?model=${encodeURIComponent(selectedModel)}`)).json();
    },
    enabled: !!selectedModel,
  });

  const allModels: any[] = data?.models ?? [];

  // Phase E: filter models based on selection.
  const models = useMemo(() => {
    if (selectedModels.size === 0) return allModels;
    return allModels.filter((m) => selectedModels.has(m.name));
  }, [allModels, selectedModels]);

  // Compute filtered totals (so summary cards reflect the filter, not all data).
  const filteredTotals = useMemo(() => {
    const productCount = models.reduce((s, m) => s + (m.productCount ?? 0), 0);
    const totalQty = models.reduce((s, m) => s + (m.totalQty ?? 0), 0);
    const totalValue = models.reduce((s, m) => s + (m.stockValue ?? 0), 0);
    return { modelCount: models.length, productCount, totalQty, totalValue };
  }, [models]);

  const serials: any[] = serialData?.serials ?? [];

  function toggle(name: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleModelFilter(name: string) {
    setSelectedModels((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearModelFilter() {
    setSelectedModels(new Set());
  }

  function selectAllModels() {
    setSelectedModels(new Set(allModels.map((m) => m.name)));
  }

  function exportAll() {
    const rows: any[] = [];
    for (const m of models) {
      for (const p of m.products) {
        rows.push({
          model: m.name, product: p.name, sku: p.sku,
          category: p.categoryName,
          tracking: p.isSerialised ? "Serialised" : "Qty-based",
          onHand: p.onHand, lastCost: p.lastCost, stockValue: p.stockValue,
        });
      }
    }
    exportToCSV("stock-by-model", rows);
  }

  function exportSerials() {
    if (!serials.length) return;
    exportToCSV(`stock-by-model-${selectedModel}-serials`, serials.map((s) => ({
      serialNo: s.serialNo, product: s.productName, status: s.status,
      warrantyEnd: s.warrantyEnd ?? "—", purchaseCost: s.purchaseCost,
    })));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock by model"
        description="Stock grouped by product model with serial-level drill-down (snapshot)."
        action={
          <div className="flex gap-2" data-print-hidden>
            {selectedModel && (
              <Button variant="outline" size="sm" onClick={() => setSelectedModel(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to models
              </Button>
            )}
            {hasGenerated && allModels.length > 0 && !selectedModel && (
              <Button
                variant={selectedModels.size > 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterOpen((o) => !o)}
              >
                <Filter className="mr-2 h-4 w-4" /> Filter
                {selectedModels.size > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">{selectedModels.size}</Badge>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!models.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={selectedModel ? exportSerials : exportAll} disabled={selectedModel ? !serials.length : !models.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {!hasGenerated ? (
        <EmptyState
          icon={ListTree}
          title="Stock by model"
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
        <h1 className="text-xl font-bold">Stock by Model</h1>
        <p className="text-sm">Snapshot as of {new Date().toLocaleDateString()}</p>
      </div>

      {/* Phase E: model filter panel — multi-select checkboxes */}
      {filterOpen && allModels.length > 0 && !selectedModel && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filter by model</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllModels}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={clearModelFilter}>Clear</Button>
                <Button variant="ghost" size="sm" onClick={() => setFilterOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedModels.size === 0
                ? "Showing all models. Click models below to filter."
                : `Showing ${selectedModels.size} of ${allModels.length} models.`}
            </p>
            <ScrollArea className="h-48 rounded-md border p-2">
              <div className="space-y-1">
                {allModels.map((m) => (
                  <label
                    key={m.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.has(m.name)}
                      onChange={() => toggleModelFilter(m.name)}
                      className="rounded"
                    />
                    <span className="flex-1 truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{m.productCount} products</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : selectedModel ? (
        // Drill-down: serial-level breakdown for the selected model.
        <>
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-1">Model: {selectedModel}</h3>
              <p className="text-xs text-muted-foreground">{serials.length} serialised units across {models.find((m) => m.name === selectedModel)?.productCount ?? 0} products.</p>
            </CardContent>
          </Card>

          {serialsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : serials.length === 0 ? (
            <div className="text-center py-12">
              <ListTree className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No serialised units for this model (products may be qty-based).</p>
            </div>
          ) : (
            <>
              {/* Desktop serial table */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Serial no.</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Warranty end</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Purchase cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s) => (
                      <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{s.serialNo}</td>
                        <td className="px-4 py-3 font-medium">{s.productName}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={
                            s.status === "IN_STOCK" ? "text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" :
                            s.status === "SOLD" ? "text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900" :
                            s.status === "IN_RMA" ? "text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900" :
                            "text-xs"
                          }>{s.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.warrantyEnd ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{s.purchaseCostDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="sm:hidden space-y-2">
                {serials.map((s) => (
                  <li key={s.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{s.serialNo}</span>
                      <Badge variant="outline" className="text-xs">{s.status}</Badge>
                    </div>
                    <p className="font-medium text-sm">{s.productName}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Warranty: {s.warrantyEnd ?? "—"}</span>
                      <span className="tabular-nums">{s.purchaseCostDisplay}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : models.length === 0 ? (
        <div className="text-center py-12">
          <ListTree className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {selectedModels.size > 0
              ? "No models match the current filter."
              : "No products found."}
          </p>
          {selectedModels.size > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={clearModelFilter}>
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Models</p><p className="text-xl font-bold tabular-nums">{filteredTotals.modelCount}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold tabular-nums">{filteredTotals.productCount}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-bold tabular-nums">{filteredTotals.totalQty}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total value</p><p className="text-xl font-bold tabular-nums">{formatBDT(filteredTotals.totalValue)}</p></CardContent></Card>
          </div>

          {/* Models table — click a row to drill into serials */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide w-8"></th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Model</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Products</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Total qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Stock value</th>
                  <th className="text-center font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Serial drill-down</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <FragmentRow key={m.name} m={m} expanded={expanded.has(m.name)} onToggle={() => toggle(m.name)} onDrillSerials={() => setSelectedModel(m.name)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {models.map((m) => (
              <li key={m.name} className="rounded-lg border p-3 space-y-2">
                <button className="flex items-center justify-between w-full" onClick={() => toggle(m.name)}>
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="text-sm tabular-nums">{m.stockValueDisplay}</span>
                </button>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{m.productCount} products · {m.totalQtyDisplay} units</span>
                  <button className="text-primary hover:underline" onClick={() => setSelectedModel(m.name)}>View serials →</button>
                </div>
                {expanded.has(m.name) && (
                  <ul className="space-y-1 pt-2 border-t">
                    {m.products.map((p: any) => (
                      <li key={p.id} className="flex justify-between text-xs">
                        <span>{p.name}</span>
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

function FragmentRow({ m, expanded, onToggle, onDrillSerials }: { m: any; expanded: boolean; onToggle: () => void; onDrillSerials: () => void }) {
  return (
    <>
      <tr className="border-t hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={onToggle}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3 font-medium cursor-pointer" onClick={onToggle}>{m.name}</td>
        <td className="px-4 py-3 text-right tabular-nums">{m.productCount}</td>
        <td className="px-4 py-3 text-right tabular-nums">{m.totalQtyDisplay}</td>
        <td className="px-4 py-3 text-right tabular-nums font-medium">{m.stockValueDisplay}</td>
        <td className="px-4 py-3 text-center">
          <button className="text-primary text-xs hover:underline" onClick={onDrillSerials}>Serials →</button>
        </td>
      </tr>
      {expanded && m.products.map((p: any) => (
        <tr key={p.id} className="border-t bg-muted/20">
          <td className="px-4 py-2"></td>
          <td className="px-4 py-2 pl-8">
            {p.name}
            <span className="text-xs text-muted-foreground ml-2">· {p.sku}</span>
            {!p.isSerialised && <Badge variant="outline" className="ml-2 text-xs">Qty-based</Badge>}
          </td>
          <td className="px-4 py-2"></td>
          <td className="px-4 py-2 text-right tabular-nums">{p.onHand}</td>
          <td className="px-4 py-2 text-right tabular-nums">{p.stockValueDisplay}</td>
          <td className="px-4 py-2"></td>
        </tr>
      ))}
    </>
  );
}
