"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer, Pause, Check, Link2 } from "lucide-react";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: async () => (await (await fetch(`/api/sales/${id}`)).json()).sale,
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">Sale not found.</p>;

  const sale: any = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sale.invoiceNo}
        description={`${formatDate(sale.date)} · ${sale.customer?.name ?? "Walk-in"}`}
        action={
          <div className="flex gap-2">
            {sale.isHeld && <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Pause className="h-3 w-3 mr-1" /> Held</Badge>}
            <Button asChild variant="outline" size="sm">
              <Link href="/sales"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.total)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.paid)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Due</p><p className={`text-xl font-bold tabular-nums ${sale.due > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(sale.due)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Mode</p><Badge variant="secondary">{sale.mode}</Badge></CardContent></Card>
      </div>

      {sale.quotationId && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-violet-500" />
            <span className="text-muted-foreground">Converted from quotation.</span>
            <Link href={`/quotations/${sale.quotationId}`} className="font-medium text-violet-600 dark:text-violet-400 hover:underline">View quote →</Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 bg-white text-black print:shadow-none">
            {/* Invoice header */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold">CCTV Inventory SaaS</h2>
                <p className="text-xs text-gray-500">Invoice</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{sale.invoiceNo}</p>
                <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
              </div>
            </div>

            {/* Customer + salesman */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium">Bill to</p>
                <p className="font-medium">{sale.customer?.name ?? "Walk-in customer"}</p>
                {sale.customer?.phone && <p className="text-xs text-gray-500">{sale.customer.phone}</p>}
                {sale.customer?.address && <p className="text-xs text-gray-500">{sale.customer.address}</p>}
              </div>
              <div className="text-right">
                {sale.salesman && <p className="text-xs text-gray-500">Salesman: {sale.salesman.name}</p>}
                <p className="text-xs text-gray-500">Payment: {sale.mode}</p>
              </div>
            </div>

            {/* Items */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left font-medium py-2">Item</th>
                    <th className="text-left font-medium py-2">Serial</th>
                    <th className="text-right font-medium py-2">Qty</th>
                    <th className="text-right font-medium py-2">Unit</th>
                    <th className="text-right font-medium py-2">Disc %</th>
                    <th className="text-right font-medium py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it: any) => (
                    <tr key={it.id} className="border-b">
                      <td className="py-2">
                        <p className="font-medium">{it.lineType === "SERVICE" ? it.description : it.product?.name ?? it.description}</p>
                        {it.product?.model && <p className="text-xs text-gray-500">{it.product.model}</p>}
                      </td>
                      <td className="py-2 text-xs font-mono text-gray-600">{it.inventoryUnit?.serialNo ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{it.qty}</td>
                      <td className="py-2 text-right tabular-nums">{formatBDT(it.unitPrice)}</td>
                      <td className="py-2 text-right tabular-nums">{it.discount || 0}%</td>
                      <td className="py-2 text-right tabular-nums font-medium">{formatBDT(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={5} className="text-right py-2 text-gray-600">Subtotal</td><td className="text-right tabular-nums py-2">{formatBDT(sale.total + sale.discount)}</td></tr>
                  {sale.discount > 0 && <tr><td colSpan={5} className="text-right py-2 text-gray-600">Discount</td><td className="text-right tabular-nums py-2">-{formatBDT(sale.discount)}</td></tr>}
                  <tr><td colSpan={5} className="text-right py-2 font-bold border-t">Total</td><td className="text-right tabular-nums py-2 font-bold">{formatBDT(sale.total)}</td></tr>
                  <tr><td colSpan={5} className="text-right py-2 text-gray-600">Paid</td><td className="text-right tabular-nums py-2">{formatBDT(sale.paid)}</td></tr>
                  {sale.due > 0 && <tr><td colSpan={5} className="text-right py-2 font-bold text-amber-700">Due</td><td className="text-right tabular-nums py-2 font-bold text-amber-700">{formatBDT(sale.due)}</td></tr>}
                </tfoot>
              </table>
            </div>
            {sale.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500 font-medium">Notes</p>
                <p className="text-sm text-gray-700">{sale.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
