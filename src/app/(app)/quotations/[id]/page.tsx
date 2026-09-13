"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Send, Check, X, Copy, FileDown, AlertTriangle, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONVERTED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: detail, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => (await (await fetch(`/api/quotations/${id}`)).json()).quotation,
    enabled: !!id,
  });

  async function updateStatus(status: string, lossReason?: string) {
    setBusy(status);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, lossReason: lossReason ?? null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: `Status: ${status}` });
        qc.invalidateQueries({ queryKey: ["quotation", id] });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onConvert() {
    setBusy("convert");
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Converted to sale", description: data.message });
        if (data.stockWarnings?.length > 0) {
          data.stockWarnings.forEach((w: any) => {
            toast({ title: `Low stock: ${w.productName}`, description: `Need ${w.requested}, have ${w.available}`, variant: "destructive" });
          });
        }
        qc.invalidateQueries({ queryKey: ["quotation", id] });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDuplicate() {
    setBusy("dup");
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Duplicated", description: data.message });
        router.push(`/quotations/${data.id}`);
      }
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!detail) return <p className="text-muted-foreground">Quotation not found.</p>;

  const q: any = detail;
  const canConvert = q.status === "ACCEPTED" || q.status === "SENT";

  return (
    <div className="space-y-6">
      <PageHeader
        title={q.quoteNo}
        description={`${formatDate(q.date)} · ${q.customerName ?? "Walk-in prospect"} · ${q.projectType}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/quotations"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Status</p><Badge className={STATUS_TONE[q.status] ?? ""} variant="secondary">{q.status}</Badge></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Valid until</p><p className="text-sm font-medium">{q.validUntil ? formatDate(q.validUntil) : "—"}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Items</p><p className="text-xl font-bold tabular-nums">{q.items.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold tabular-nums">{formatBDT(q.total)}</p></CardContent></Card>
      </div>

      {/* Status actions */}
      {q.status !== "CONVERTED" && (
        <Card>
          <CardContent className="py-4 flex flex-wrap gap-2">
            {q.status === "DRAFT" && (
              <Button variant="outline" onClick={() => updateStatus("SENT")} disabled={!!busy}>
                <Send className="mr-2 h-4 w-4" /> Mark as Sent
              </Button>
            )}
            {(q.status === "SENT" || q.status === "DRAFT") && (
              <Button onClick={() => updateStatus("ACCEPTED")} disabled={!!busy}>
                <Check className="mr-2 h-4 w-4" /> Mark Accepted
              </Button>
            )}
            {(q.status === "SENT" || q.status === "DRAFT") && (
              <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={!!busy}>
                <X className="mr-2 h-4 w-4" /> Reject
              </Button>
            )}
            {q.status === "ACCEPTED" && canConvert && (
              <Button onClick={onConvert} disabled={!!busy}>
                {busy === "convert" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Convert to Sale
              </Button>
            )}
            <Button variant="outline" onClick={onDuplicate} disabled={!!busy}>
              {busy === "dup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />} Duplicate
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <FileDown className="mr-2 h-4 w-4" /> Print
            </Button>
          </CardContent>
        </Card>
      )}

      {q.status === "CONVERTED" && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">CONVERTED</Badge>
            <p className="text-sm text-muted-foreground">
              Converted to sale invoice. Review and finalize in the Sales module.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quote items table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Type</th>
                  <th className="text-left font-medium px-3 py-2">Description</th>
                  <th className="text-right font-medium px-3 py-2">Qty</th>
                  <th className="text-right font-medium px-3 py-2">Unit</th>
                  <th className="text-right font-medium px-3 py-2">Disc %</th>
                  <th className="text-right font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{it.lineType}</Badge></td>
                    <td className="px-3 py-2">{it.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.discount || 0}%</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBDT(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr><td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-3 py-2 text-right tabular-nums">{formatBDT(q.subtotal)}</td></tr>
                <tr><td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Discount</td><td className="px-3 py-2 text-right tabular-nums">-{formatBDT(q.discount)}</td></tr>
                <tr><td colSpan={5} className="px-3 py-2 text-right font-bold">Total</td><td className="px-3 py-2 text-right tabular-nums font-bold">{formatBDT(q.total)}</td></tr>
              </tfoot>
            </table>
          </div>
          {q.termsConditions && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">Terms & conditions</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.termsConditions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject quotation</DialogTitle>
            <DialogDescription>A loss reason is required (doc §5.6).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Price too high / went with competitor" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={rejectReason.length < 3} onClick={() => { updateStatus("REJECTED", rejectReason); setRejectOpen(false); }}>
              Reject quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
