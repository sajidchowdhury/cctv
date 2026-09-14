"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: async () => (await (await fetch(`/cctv/api/purchases/${id}`)).json()).purchase,
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">Purchase not found.</p>;

  // Block edit/delete if the purchase has been settled by a payment.
  const isLocked = data.paid > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.invoiceNo}
        description={`${formatDate(data.date)} · ${data.supplierName}`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href="/purchases"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={isLocked}>
              <Link
                href={isLocked ? "#" : `/purchases/new?resume=${id}&edit=1`}
                aria-disabled={isLocked}
                className={isLocked ? "pointer-events-none opacity-50" : ""}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-destructive" disabled={deleting || isLocked}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
              }
              title="Delete this purchase?"
              description="This will permanently remove all inventory units created by this purchase and reverse the supplier's balance. The purchase is soft-deleted (data preserved). Cannot delete if any units have been sold or are in RMA."
              destructive
              confirmLabel="Delete purchase"
              onConfirm={async () => {
                setDeleting(true);
                try {
                  const res = await fetch(`/cctv/api/purchases/${id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast({ title: "Failed", description: data.error ?? "Delete failed.", variant: "destructive" });
                  } else {
                    toast({ title: "Purchase deleted", description: data.message });
                    qc.invalidateQueries({ queryKey: ["purchases"] });
                    router.push("/purchases");
                  }
                } finally {
                  setDeleting(false);
                }
              }}
            />
          </div>
        }
      />

      {isLocked && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangleIcon />
            <span>
              This purchase has payments settled against it (paid {formatBDT(data.paid)}). Reverse the payment(s) first to enable edit/delete.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold tabular-nums">{formatBDT(data.total)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold tabular-nums">{formatBDT(data.paid)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Due</p><p className={`text-xl font-bold tabular-nums ${data.due > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(data.due)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Mode</p><Badge variant="secondary">{data.mode}</Badge></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Items ({data.items.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Product</th>
                  <th className="text-right font-medium px-3 py-2">Qty</th>
                  <th className="text-right font-medium px-3 py-2">Unit</th>
                  <th className="text-right font-medium px-3 py-2">Total</th>
                  <th className="text-center font-medium px-3 py-2">Warranty</th>
                  <th className="text-left font-medium px-3 py-2">Serials</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{it.productName}</p>
                      <p className="text-xs text-muted-foreground">{it.productModel ?? "—"} · {it.productSku}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBDT(it.lineTotal)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{it.warrantyMonths > 0 ? `${it.warrantyMonths}mo` : "—"}</td>
                    <td className="px-3 py-2">
                      {it.serials.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {it.serials.slice(0, 5).map((s: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">{s}</Badge>
                          ))}
                          {it.serials.length > 5 && <span className="text-xs text-muted-foreground">+{it.serials.length - 5} more</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{data.notes}</p></CardContent>
        </Card>
      )}

      {/* Inventory units created from this purchase */}
      <Card>
        <CardHeader><CardTitle className="text-base">Inventory units</CardTitle></CardHeader>
        <CardContent>
          {data.items.every((it: any) => it.inventoryUnits.length === 0) ? (
            <p className="text-sm text-muted-foreground">No serialised units (fractional/non-serialised items).</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scroll-area-thin">
              {data.items.flatMap((it: any, i: number) =>
                it.inventoryUnits.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs">{u.serialNo}</span>
                      <p className="text-xs text-muted-foreground">{it.productName}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{u.status}</Badge>
                      {u.warrantyEnd && <p className="text-xs text-muted-foreground mt-1">Warranty until {formatDate(u.warrantyEnd)}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
