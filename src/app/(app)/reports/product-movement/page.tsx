"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Printer, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Search, X, Package } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Product = { id: string; name: string; sku: string; isSerialised: boolean; onHand: number };

export default function ProductMovementReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [productId, setProductId] = useState("");
  const [appliedProductId, setAppliedProductId] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Phase 6+: product picker is now a debounced search (was a one-shot fetch
  // of ALL products on mount, which was slow + bad UX for shops with 100+
  // products). Products only appear when the user types.
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Debounce search input — 300ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounced product search — 300ms after the user stops typing, fetch
  // products matching the search term. Only fires when productSearch is
  // non-empty, so no products are loaded until the user types.
  useEffect(() => {
    const q = (productSearch ?? "").trim();
    if (!q) { setProducts([]); return; }
    const timer = setTimeout(() => {
      fetch(`/cctv/api/products?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setProducts(d.products ?? []));
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-product-movement", appliedProductId, appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedProductId ? { productId: appliedProductId } : {}),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/product-movement?${params}`)).json();
    },
    enabled: hasGenerated,
  });

  const movements: any[] = data?.rows ?? [];
  const productSummaries: any[] = data?.products ?? [];
  const summary = data?.summary;

  function applyFilters() {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedProductId(productId);
    setHasGenerated(true);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product movement"
        description="All IN/OUT movements per product with running stock balance (doc §5.3)."
        action={
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!movements.length} data-print-hidden>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        }
      />

      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product (optional — leave blank for all)</Label>
              {/* Phase 6+: searchable product picker (was a plain Select that
                  loaded ALL products on mount). Now products only appear when
                  the user types — same pattern as the customer picker in
                  sales/new. */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    // Clear selection if the user is editing the search.
                    if (selectedProduct && e.target.value !== selectedProduct.name) {
                      setSelectedProduct(null);
                      setProductId("");
                    }
                  }}
                  placeholder="Search product to filter… (leave blank for all)"
                  className="pl-9"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch("");
                      setSelectedProduct(null);
                      setProductId("");
                      setProducts([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Search results dropdown — only show when searching AND
                    no product is selected yet. */}
                {productSearch && !selectedProduct && products.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg max-h-60 overflow-y-auto scroll-area-thin">
                    {products.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setProductId(p.id);
                          setProductSearch(p.name);
                          setProducts([]);
                          setPage(1);
                        }}
                        className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku} · Stock {p.onHand}</p>
                        </div>
                        {p.isSerialised ? (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900">Serialised</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">Qty-based</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* No-results hint */}
                {productSearch && !selectedProduct && products.length === 0 && productSearch.length >= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No products match &quot;{productSearch}&quot;.
                  </p>
                )}
              </div>
              {/* Selected product badge — shows when a product is picked */}
              {selectedProduct && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Package className="h-3 w-3 mr-1" />
                    {selectedProduct.name}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setProductId("");
                      setProductSearch("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear (all products)
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={applyFilters} />
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference / product / party…"
              className="pl-9"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={applyFilters}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Product Movement Report</h1>
        <p className="text-sm">Period: {appliedFrom} to {appliedTo}{appliedProductId ? ` · Product: ${products.find((p) => p.id === appliedProductId)?.name ?? "—"}` : " · All products"}</p>
      </div>

      {!hasGenerated ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Product movement"
          description="Set filters and click Apply (or Generate) to load the report data."
          action={
            <Button onClick={applyFilters}>
              <Search className="mr-2 h-4 w-4" /> Generate report
            </Button>
          }
        />
      ) : (
        <>
      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12">
          <ArrowLeftRight className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No stock movements in this period.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold tabular-nums">{summary?.productCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Movements</p><p className="text-xl font-bold tabular-nums">{summary?.movementCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total IN</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.totalInDisplay ?? "0"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total OUT</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary?.totalOutDisplay ?? "0"}</p></CardContent></Card>
          </div>

          {/* Per-product summary (only when all-products mode) */}
          {!appliedProductId && productSummaries.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h3 className="text-sm font-semibold mb-3">Per-product summary</h3>
                <div className="overflow-x-auto rounded-lg border scroll-area-thin">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product</th>
                        <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Tracking</th>
                        <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Opening</th>
                        <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">IN</th>
                        <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">OUT</th>
                        <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSummaries.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">{p.isSerialised ? "Serialised" : "Qty-based"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.openingStock}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{p.totalIn}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">{p.totalOut}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{p.closingStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Movements table */}
          <div className="flex justify-end" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`product-movement-${appliedFrom}-to-${appliedTo}`, movements.map((m) => ({
              date: m.date, type: m.type, reference: m.ref, party: m.partyName,
              product: m.productName, direction: m.direction, qty: m.qty,
              unitPrice: m.unitPrice, lineTotal: m.lineTotal, balance: m.balance,
            })))}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Reference</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Party</th>
                  {!appliedProductId && <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product</th>}
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Unit price</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Line total</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Stock balance</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m: any, i: number) => (
                  <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDate(m.date)}</td>
                    <td className="px-4 py-3">
                      {m.direction === "in" ? (
                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                          <ArrowDownCircle className="h-3 w-3 mr-1" />IN
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:border-red-800 dark:text-red-400">
                          <ArrowUpCircle className="h-3 w-3 mr-1" />OUT
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{m.ref}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.partyName}</td>
                    {!appliedProductId && <td className="px-4 py-3">{m.productName}</td>}
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${m.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {m.direction === "in" ? "+" : "−"}{m.qtyDisplay}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{m.unitPriceDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.lineTotalDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{m.balanceDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {movements.map((m: any, i: number) => (
              <li key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  {m.direction === "in" ? (
                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                      <ArrowDownCircle className="h-3 w-3 mr-1" />IN
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:border-red-800 dark:text-red-400">
                      <ArrowUpCircle className="h-3 w-3 mr-1" />OUT
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
                </div>
                <p className="font-medium text-sm">{m.ref}</p>
                {!appliedProductId && <p className="text-xs text-muted-foreground">{m.productName}</p>}
                <p className="text-xs text-muted-foreground">{m.partyName}</p>
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className={m.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {m.direction === "in" ? "+" : "−"}{m.qtyDisplay} @ {m.unitPriceDisplay}
                  </span>
                  <span className="font-medium tabular-nums">Stock: {m.balanceDisplay}</span>
                </div>
              </li>
            ))}
          </ul>
          <ReportPagination
            page={data?.page ?? 1}
            pageSize={data?.pageSize ?? pageSize}
            total={data?.total ?? 0}
            onChange={({ page: p, pageSize: ps }: PaginationState) => { setPage(p); setPageSize(ps); }}
          />
        </>
      )}
        </>
      )}
    </div>
  );
}
