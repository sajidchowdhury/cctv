"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Printer, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
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

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await (await fetch("/cctv/api/products")).json()).products as Product[],
  });
  const products = productsData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["report-product-movement", appliedProductId, appliedFrom, appliedTo],
    queryFn: async () => {
      const url = `/api/reports/product-movement?from=${appliedFrom}&to=${appliedTo}${appliedProductId ? `&productId=${appliedProductId}` : ""}`;
      return await (await fetch(url)).json();
    },
  });

  const movements: any[] = data?.movements ?? [];
  const productSummaries: any[] = data?.products ?? [];
  const summary = data?.summary;

  function applyFilters() {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedProductId(productId);
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
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="All products…" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.sku} · Stock {p.onHand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={applyFilters} />
            </div>
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
        </>
      )}
    </div>
  );
}
