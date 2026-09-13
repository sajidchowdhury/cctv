"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, PackageSearch, ScanLine } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Row = {
  invoiceNo: string; date: string; dateDisplay: string;
  supplierName: string;
  productName: string; productSku: string | null; productModel: string | null;
  qty: number; unitPrice: number; salesPrice: number | null;
  warrantyMonths: number; lineTotal: number;
  serials: string[]; serialsDisplay: string; serialCount: number;
  mode: string;
  qtyDisplay: string; unitPriceDisplay: string;
  salesPriceDisplay: string; lineTotalDisplay: string;
};

export default function PurchaseDetailedReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);

  const { data, isLoading } = useQuery({
    queryKey: ["report-purchase-detailed", appliedFrom, appliedTo],
    queryFn: async () => await (await fetch(`/api/reports/purchase-detailed?from=${appliedFrom}&to=${appliedTo}`)).json(),
  });

  const rows: Row[] = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase report (detailed)"
        description="Invoice-wise line items with serial capture (doc §5.3)."
        action={
          <div className="flex gap-2" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!rows.length}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`purchase-detailed-${appliedFrom}-to-${appliedTo}`, rows.map((r) => ({
              invoiceNo: r.invoiceNo, date: r.dateDisplay, supplier: r.supplierName,
              product: r.productName, sku: r.productSku ?? "", model: r.productModel ?? "",
              qty: r.qty, unitPrice: r.unitPrice, salesPrice: r.salesPrice ?? "",
              warrantyMonths: r.warrantyMonths, lineTotal: r.lineTotal,
              serials: r.serialsDisplay, serialCount: r.serialCount, mode: r.mode,
            })))} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div data-print-hidden>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => { setAppliedFrom(from); setAppliedTo(to); }} />
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Purchase Report (Detailed)</h1>
        <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <PackageSearch className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No purchases in this period.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold tabular-nums">{summary?.invoiceCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Line items</p><p className="text-xl font-bold tabular-nums">{summary?.lineItemCount ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total qty</p><p className="text-xl font-bold tabular-nums">{summary?.totalQty ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total purchase</p><p className="text-xl font-bold tabular-nums">{summary?.totalPurchaseDisplay ?? "—"}</p></CardContent></Card>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Invoice</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Supplier</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Unit</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Sales</th>
                  <th className="text-center font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Warranty</th>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Serials</th>
                  <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.invoiceNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{r.dateDisplay}</td>
                    <td className="px-4 py-3">{r.supplierName}</td>
                    <td className="px-4 py-3">
                      {r.productName}
                      {r.productModel && <span className="text-xs text-muted-foreground ml-1">· {r.productModel}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.qtyDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.unitPriceDisplay}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.salesPriceDisplay}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{r.warrantyMonths > 0 ? `${r.warrantyMonths}mo` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.serialCount > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs"><ScanLine className="h-3 w-3 mr-1" />{r.serialCount}</Badge>
                          <span className="text-xs font-mono text-muted-foreground">{r.serials.slice(0, 2).join(", ")}{r.serialCount > 2 && ` +${r.serialCount - 2}`}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{r.lineTotalDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{r.invoiceNo}</span>
                  <span className="text-xs text-muted-foreground">{r.dateDisplay}</span>
                </div>
                <p className="text-sm">{r.supplierName}</p>
                <p className="text-xs text-muted-foreground">{r.productName}</p>
                {r.serialCount > 0 && <p className="text-xs font-mono text-muted-foreground">{r.serials.join(", ")}</p>}
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span>{r.qtyDisplay} × {r.unitPriceDisplay}</span>
                  <span className="font-medium tabular-nums">{r.lineTotalDisplay}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
