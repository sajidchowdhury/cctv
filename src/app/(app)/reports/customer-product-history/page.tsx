"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, History, Loader2, Search, Download, Printer, User, Package } from "lucide-react";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Customer = { id: string; name: string; phone: string | null };
type Product = { id: string; name: string; model: string | null; sku: string };

type SaleRow = {
  saleId: string;
  invoiceNo: string;
  date: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  salesmanName: string | null;
};

type ReportData = {
  customer: { id: string; name: string; phone: string | null } | null;
  product: { id: string; name: string; model: string | null; sku: string } | null;
  period: { from: string; to: string };
  sales: SaleRow[];
  summary: {
    saleCount: number;
    totalQty: number;
    totalAmount: number;
    firstSaleDate: string | null;
    lastSaleDate: string | null;
    avgUnitPrice: number;
    minUnitPrice: number;
    maxUnitPrice: number;
  };
};

function toIsoLocal(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export default function CustomerProductHistoryReportPage() {
  // ── Filter state ──────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  // Default date range: 1 year ago → today.
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return toIsoLocal(d);
  });
  const [to, setTo] = useState(toIsoLocal(new Date()));

  // ── Customer search ───────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const q = customerSearch.trim();
    if (!q) { setCustomers([]); return; }
    const t = setTimeout(() => {
      fetch(`/cctv/api/customers?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setCustomers(d.customers ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // ── Product search ─────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const q = productSearch.trim();
    if (!q) { setProducts([]); return; }
    const t = setTimeout(() => {
      fetch(`/cctv/api/products?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setProducts(d.products ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  // ── Report data ────────────────────────────────────────────────────
  // Only fetch when both customerId + productId are selected. The query is
  // disabled otherwise to avoid a 422 from the API.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-customer-product-history", customerId, productId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({
        customerId,
        productId,
        from,
        to,
      });
      const r = await fetch(`/cctv/api/reports/customer-product-history?${params.toString()}`);
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to load report");
      }
      return (await r.json()) as ReportData;
    },
    enabled: !!customerId && !!productId,
  });

  function exportCSV() {
    if (!data) return;
    const rows = data.sales.map((s) => ({
      date: formatDate(s.date),
      invoice: s.invoiceNo,
      qty: s.qty,
      unitPrice: s.unitPrice,
      lineTotal: s.lineTotal,
      salesman: s.salesmanName ?? "",
    }));
    exportToCSV(`customer-product-history-${data.customer?.name ?? "x"}-${data.product?.name ?? "y"}`, rows);
  }

  const canRun = !!customerId && !!productId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Product History"
        description="See how many times a product was sold to a customer, at what price + qty."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" /> All reports</Link>
            </Button>
            {data && data.sales.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => window.print()} data-print-hidden>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV} data-print-hidden>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ── Filter form ────────────────────────────────────────────── */}
      <Card data-print-hidden>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Pick a customer + product + date range. Report generates automatically when all three are set.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Customer picker */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer by name or phone…"
              />
              {customerSearch && customers.length > 0 && (
                <div className="rounded-lg border max-h-48 overflow-y-auto scroll-area-thin">
                  {customers.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setCustomers([]); }}
                      className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                      {customerId === c.id && <Badge variant="secondary" className="text-xs">Selected</Badge>}
                    </button>
                  ))}
                </div>
              )}
              {customerId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Selected: {customers.find((c) => c.id === customerId)?.name ?? customerId}
                </p>
              )}
            </div>

            {/* Product picker */}
            <div className="space-y-2">
              <Label>Product *</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search product by name, model, or SKU…"
              />
              {productSearch && products.length > 0 && (
                <div className="rounded-lg border max-h-48 overflow-y-auto scroll-area-thin">
                  {products.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setProductId(p.id); setProductSearch(p.name); setProducts([]); }}
                      className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.model ?? "—"} · {p.sku}</p>
                      </div>
                      {productId === p.id && <Badge variant="secondary" className="text-xs">Selected</Badge>}
                    </button>
                  ))}
                </div>
              )}
              {productId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Selected: {products.find((p) => p.id === productId)?.name ?? productId}
                </p>
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {!canRun && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Select both a customer and a product to generate the report.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Loading state ──────────────────────────────────────────── */}
      {(isLoading || isFetching) && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Report content ─────────────────────────────────────────── */}
      {data && !isFetching && (
        <>
          {/* Customer + product context (also visible in print) */}
          <Card>
            <CardContent className="py-4 grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer</p>
                  <p className="font-medium">{data.customer?.name ?? "—"}</p>
                  {data.customer?.phone && <p className="text-xs text-muted-foreground">{data.customer.phone}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Product</p>
                  <p className="font-medium">{data.product?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.product?.model ?? "—"} · {data.product?.sku ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Times bought</p><p className="text-xl font-bold tabular-nums">{data.summary.saleCount}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total qty</p><p className="text-xl font-bold tabular-nums">{data.summary.totalQty}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total spent</p><p className="text-xl font-bold tabular-nums">{formatBDT(data.summary.totalAmount)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Avg unit price</p><p className="text-xl font-bold tabular-nums">{formatBDT(data.summary.avgUnitPrice)}</p></CardContent></Card>
          </div>

          {/* Price range + date range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardContent className="py-4 space-y-1">
              <p className="text-xs text-muted-foreground">Price range</p>
              <p className="text-sm font-medium tabular-nums">
                {formatBDT(data.summary.minUnitPrice)} – {formatBDT(data.summary.maxUnitPrice)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="py-4 space-y-1">
              <p className="text-xs text-muted-foreground">Purchase period</p>
              <p className="text-sm font-medium">
                {data.summary.firstSaleDate ? formatDate(data.summary.firstSaleDate) : "—"} → {data.summary.lastSaleDate ? formatDate(data.summary.lastSaleDate) : "—"}
              </p>
            </CardContent></Card>
          </div>

          {/* Sales table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sale history ({data.sales.length})</CardTitle>
              <CardDescription>Date-wise invoices for this customer + product, within {formatDate(data.period.from)} → {formatDate(data.period.to)}.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.sales.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No sales of this product to this customer in the selected date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left font-medium py-2 pr-2 text-xs uppercase tracking-wide">Date</th>
                        <th className="text-left font-medium py-2 px-2 text-xs uppercase tracking-wide">Invoice</th>
                        <th className="text-right font-medium py-2 px-2 text-xs uppercase tracking-wide">Qty</th>
                        <th className="text-right font-medium py-2 px-2 text-xs uppercase tracking-wide">Unit price</th>
                        <th className="text-right font-medium py-2 px-2 text-xs uppercase tracking-wide">Line total</th>
                        <th className="text-left font-medium py-2 pl-2 text-xs uppercase tracking-wide">Salesman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((s) => (
                        <tr key={s.saleId} className="border-b border-muted last:border-0">
                          <td className="py-2 pr-2 tabular-nums">{formatDate(s.date)}</td>
                          <td className="py-2 px-2 font-medium">{s.invoiceNo}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{s.qty}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{formatBDT(s.unitPrice)}</td>
                          <td className="py-2 px-2 text-right tabular-nums font-medium">{formatBDT(s.lineTotal)}</td>
                          <td className="py-2 pl-2 text-muted-foreground">{s.salesmanName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2">
                        <td colSpan={2} className="py-2 font-bold text-right">Total</td>
                        <td className="py-2 px-2 text-right tabular-nums font-bold">{data.summary.totalQty}</td>
                        <td className="py-2 px-2"></td>
                        <td className="py-2 px-2 text-right tabular-nums font-bold">{formatBDT(data.summary.totalAmount)}</td>
                        <td className="py-2 pl-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
