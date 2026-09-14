"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Unit = { id: string; serialNo: string; productName: string; productModel: string | null; warrantyEnd: string | null; daysLeft: number | null; expired: boolean; customerName: string; customerPhone: string | null; saleInvoice: string | null };

export default function WarrantyExpiryReportPage() {
  const now = new Date();
  const [from] = useState(now.toISOString().slice(0, 10));
  const [to] = useState(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["report-warranty-expiry", from, to],
    queryFn: async () => (await (await fetch(`/cctv/api/reports/warranty-expiry?from=${from}&to=${to}`)).json()),
  });

  const units: Unit[] = data?.units ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Warranty expiry" description={`Upcoming warranty ends: ${from} to ${to} (doc §5.3).`} action={<Button variant="outline" size="sm" onClick={() => exportToCSV(`warranty-expiry-${from}-to-${to}`, units)} disabled={!units.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>} />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-bold tabular-nums">{data?.count ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Expiring soon (≤30d)</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{units.filter((u) => !u.expired && (u.daysLeft ?? 999) <= 30).length}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Already expired</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{units.filter((u) => u.expired).length}</p></CardContent></Card>
          </div>
          {units.length === 0 ? (
            <div className="text-center py-8"><ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No warranties expiring in this window.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left font-medium px-3 py-2">Product</th><th className="text-left font-medium px-3 py-2">Serial</th><th className="text-left font-medium px-3 py-2">Customer</th><th className="text-left font-medium px-3 py-2">Invoice</th><th className="text-left font-medium px-3 py-2">Warranty until</th><th className="text-left font-medium px-3 py-2">Days left</th><th className="text-left font-medium px-3 py-2">Status</th></tr></thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-3 py-2"><p className="font-medium">{u.productName}</p><p className="text-xs text-muted-foreground">{u.productModel ?? "—"}</p></td>
                      <td className="px-3 py-2 font-mono text-xs">{u.serialNo}</td>
                      <td className="px-3 py-2">{u.customerName}{u.customerPhone && <p className="text-xs text-muted-foreground">{u.customerPhone}</p>}</td>
                      <td className="px-3 py-2 text-xs">{u.saleInvoice ?? "—"}</td>
                      <td className="px-3 py-2">{u.warrantyEnd ? formatDate(u.warrantyEnd) : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{u.daysLeft !== null ? (u.expired ? `${Math.abs(u.daysLeft)}d ago` : `${u.daysLeft}d`) : "—"}</td>
                      <td className="px-3 py-2">{u.expired ? <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><ShieldAlert className="h-3 w-3 mr-1" />Expired</Badge> : (u.daysLeft ?? 999) <= 30 ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Expiring soon</Badge> : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><ShieldCheck className="h-3 w-3 mr-1" />Active</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
