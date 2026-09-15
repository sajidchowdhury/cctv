"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Send, Check, X, Copy, FileDown, AlertTriangle, ShoppingCart, ScanLine, Zap, Package } from "lucide-react";
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

  // Phase D: serial picker state
  const [serialPickerOpen, setSerialPickerOpen] = useState(false);
  const [availableSerials, setAvailableSerials] = useState<Record<string, { id: string; serialNo: string }[]>>({});
  const [selectedSerials, setSelectedSerials] = useState<Record<string, string[]>>({});
  const [serialsLoading, setSerialsLoading] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => (await (await fetch(`/cctv/api/quotations/${id}`)).json()).quotation,
    enabled: !!id,
  });

  // Phase D: fetch available IN_STOCK serials for serialised product lines
  // when the serial picker dialog opens.
  async function openSerialPicker() {
    if (!detail) return;
    const items = (detail as any).items ?? [];
    const serialisedItems = items.filter(
      (it: any) => it.lineType === "PRODUCT" && it.productId && it.product?.isSerialised
    );

    if (serialisedItems.length === 0) {
      // No serialised products — convert directly without the picker.
      doConvert({});
      return;
    }

    setSerialPickerOpen(true);
    setSerialsLoading(true);
    setSelectedSerials({});

    try {
      // Fetch available serials for each serialised product.
      // Collect unique product IDs from serialised quotation items.
      const productIdSet = new Set<string>();
      for (const it of serialisedItems) {
        if (it.productId) productIdSet.add(String(it.productId));
      }
      const productIds = Array.from(productIdSet);
      const serialsByProduct: Record<string, { id: string; serialNo: string }[]> = {};

      for (const pid of productIds) {
        const res = await fetch(`/cctv/api/sales/search?q=${encodeURIComponent(pid)}`);
        const data = await res.json();
        // The search API returns matching products with their IN_STOCK serials.
        const product = (data.results ?? []).find((p: any) => p.productId === pid);
        if (product) {
          serialsByProduct[pid] = product.serials ?? [];
        }
      }

      setAvailableSerials(serialsByProduct);

      // Auto-assign the first N serials for each line.
      const auto: Record<string, string[]> = {};
      for (const it of serialisedItems) {
        const serials = serialsByProduct[it.productId] ?? [];
        const qty = Math.floor(it.qty);
        auto[it.id] = serials.slice(0, qty).map((s) => s.id);
      }
      setSelectedSerials(auto);
    } catch {
      toast({ title: "Failed to load serials", variant: "destructive" });
    } finally {
      setSerialsLoading(false);
    }
  }

  function toggleSerial(itemId: string, unitId: string, maxQty: number) {
    setSelectedSerials((prev) => {
      const current = prev[itemId] ?? [];
      if (current.includes(unitId)) {
        return { ...prev, [itemId]: current.filter((id) => id !== unitId) };
      }
      if (current.length >= maxQty) {
        toast({
          title: `Max ${maxQty} serial(s) for this line`,
          description: `Deselect one to pick another.`,
          variant: "destructive",
        });
        return prev;
      }
      return { ...prev, [itemId]: [...current, unitId] };
    });
  }

  function autoAssign(itemId: string, productId: string, qty: number) {
    const serials = availableSerials[productId] ?? [];
    setSelectedSerials((prev) => ({
      ...prev,
      [itemId]: serials.slice(0, qty).map((s) => s.id),
    }));
  }

  async function updateStatus(status: string, lossReason?: string) {
    setBusy(status);
    try {
      const res = await fetch(`/cctv/api/quotations/${id}`, {
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
        qc.invalidateQueries({ queryKey: ["quotations"] });
      }
    } finally {
      setBusy(null);
    }
  }

  // Phase D: doConvert replaces onConvert. Accepts the serials map.
  async function doConvert(serials: Record<string, string[]>) {
    setBusy("convert");
    setSerialPickerOpen(false);
    try {
      const res = await fetch(`/cctv/api/quotations/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serials }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 = oversell blocked or serial validation failed.
        if (res.status === 409) {
          if (data.stockShortfalls?.length > 0) {
            const lines = data.stockShortfalls.map(
              (s: any) => `${s.productName}: need ${s.requested}, have ${s.available}`
            );
            toast({
              title: "Stock insufficient — conversion blocked",
              description: lines.join(" · "),
              variant: "destructive",
            });
          } else if (data.serialErrors?.length > 0) {
            toast({
              title: "Serial validation failed",
              description: data.serialErrors.join(" · "),
              variant: "destructive",
            });
          } else {
            toast({ title: "Failed", description: data.error ?? "Conversion failed.", variant: "destructive" });
          }
        } else {
          toast({ title: "Failed", description: data.error ?? "Conversion failed.", variant: "destructive" });
        }
      } else {
        toast({ title: "Converted to sale", description: data.message });
        qc.invalidateQueries({ queryKey: ["quotation", id] });
        qc.invalidateQueries({ queryKey: ["quotations"] });
      }
    } finally {
      setBusy(null);
    }
  }

  // Check if all serialised lines have the correct number of serials picked.
  function canConfirmConvert(): boolean {
    if (!detail) return false;
    const items = (detail as any).items ?? [];
    for (const it of items) {
      if (it.lineType !== "PRODUCT" || !it.productId || !it.product?.isSerialised) continue;
      const picked = selectedSerials[it.id]?.length ?? 0;
      if (picked !== Math.floor(it.qty)) return false;
    }
    return true;
  }

  async function onDuplicate() {
    setBusy("dup");
    try {
      const res = await fetch(`/cctv/api/quotations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Duplicated", description: data.message });
        qc.invalidateQueries({ queryKey: ["quotations"] });
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
              <Button onClick={openSerialPicker} disabled={!!busy}>
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

      {/* Phase D: Serial picker dialog — pick specific serials before converting */}
      <Dialog open={serialPickerOpen} onOpenChange={(o) => { if (!busy) setSerialPickerOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Pick serial numbers
            </DialogTitle>
            <DialogDescription>
              Select specific serial numbers for each serialised product. Serials are auto-assigned from available stock — adjust if needed.
            </DialogDescription>
          </DialogHeader>

          {serialsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4 pr-2">
                {(q.items as any[])
                  .filter((it: any) => it.lineType === "PRODUCT" && it.productId && it.product?.isSerialised)
                  .map((it: any) => {
                    const serials = availableSerials[it.productId] ?? [];
                    const picked = selectedSerials[it.id] ?? [];
                    const qty = Math.floor(it.qty);
                    return (
                      <div key={it.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{it.product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Need {qty} serial(s) · {picked.length}/{qty} picked
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => autoAssign(it.id, it.productId, qty)}
                            disabled={serials.length < qty}
                            title="Auto-assign first available serials"
                          >
                            <Zap className="mr-1 h-3 w-3" /> Auto
                          </Button>
                        </div>
                        {serials.length === 0 ? (
                          <p className="text-xs text-red-600 dark:text-red-400">No IN_STOCK serials available for this product.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {serials.map((s) => {
                              const isSelected = picked.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleSerial(it.id, s.id, qty)}
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono transition-colors ${
                                    isSelected
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                  }`}
                                >
                                  {isSelected && <Check className="mr-1 h-3 w-3" />}
                                  {s.serialNo}
                                </button>
                              );
                            })}
                            {serials.length > 20 && (
                              <span className="text-xs text-muted-foreground self-center">+{serials.length - 20} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Non-serialised + service lines info */}
                {(q.items as any[]).some((it: any) => !(it.lineType === "PRODUCT" && it.product?.isSerialised)) && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      <Package className="inline h-3 w-3 mr-1" />
                      Non-serialised products and service lines will be added automatically (qty-based, no serial pick needed).
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              className="sm:mr-auto"
              disabled={!!busy}
              onClick={() => doConvert({})}
            >
              Skip — pick serials later
            </Button>
            <Button variant="outline" onClick={() => setSerialPickerOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              disabled={!canConfirmConvert() || !!busy}
              onClick={() => doConvert(selectedSerials)}
            >
              {busy === "convert" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirm Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
