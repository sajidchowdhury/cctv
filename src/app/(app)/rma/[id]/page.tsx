"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";

const STAGES = ["RECEIVED_FROM_CUSTOMER", "SENT_TO_VENDOR", "UNDER_REPAIR", "RETURNED_FROM_VENDOR", "DELIVERED_TO_CUSTOMER"];
const STAGE_TONE: Record<string, string> = {
  RECEIVED_FROM_CUSTOMER: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  SENT_TO_VENDOR: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  UNDER_REPAIR: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  RETURNED_FROM_VENDOR: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  DELIVERED_TO_CUSTOMER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default function RmaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [transitionNotes, setTransitionNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["rma-detail", id],
    queryFn: async () => (await (await fetch(`/cctv/api/rma/${id}`)).json()).ticket,
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">RMA not found.</p>;

  const t: any = data;
  const currentStageIndex = STAGES.indexOf(t.stage);
  const isClosed = t.stage === "DELIVERED_TO_CUSTOMER";
  const nextStage = !isClosed ? STAGES[currentStageIndex + 1] : null;

  async function transition(stage: string) {
    setBusy(true);
    try {
      const res = await fetch(`/cctv/api/rma/${id}/transition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, notes: transitionNotes || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Failed", description: data.error, variant: "destructive" }); }
      else {
        toast({ title: "Stage advanced", description: data.message });
        setTransitionNotes("");
        qc.invalidateQueries({ queryKey: ["rma-detail", id] });
        qc.invalidateQueries({ queryKey: ["rma-tickets"] });
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.rmaNo}
        description={
          <div className="flex items-center gap-2">
            <Badge className={STAGE_TONE[t.stage] ?? ""} variant="secondary">{t.stage.replace(/_/g, " ")}</Badge>
            {t.overdue && <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>}
          </div> as any
        }
        action={<Button asChild variant="outline" size="sm"><Link href="/rma"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>}
      />

      {/* Stage progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-2">
            {STAGES.map((s, i) => (
              <div key={s} className="flex-1 text-center">
                <div className={`h-2 rounded-full mb-2 ${i <= currentStageIndex ? "bg-primary" : "bg-muted"}`} />
                <p className={`text-xs ${i === currentStageIndex ? "font-bold text-primary" : i < currentStageIndex ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {s.replace(/_/g, " ").split(" ")[0]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details + actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Customer:</span> {t.customer?.name ?? "—"} {t.customer?.phone && <span className="text-muted-foreground">({t.customer.phone})</span>}</p>
            <p><span className="text-muted-foreground">Product:</span> {t.product?.name ?? "—"} {t.product?.model && <span className="text-muted-foreground">({t.product.model})</span>}</p>
            {t.inventoryUnit && <p><span className="text-muted-foreground">Serial:</span> <code className="text-xs">{t.inventoryUnit.serialNo}</code> {t.inventoryUnit.warrantyEnd && <span className="text-xs">· warranty until {new Date(t.inventoryUnit.warrantyEnd).toLocaleDateString("en-GB")}</span>}</p>}
            <p><span className="text-muted-foreground">Fault:</span> {t.faultReason}</p>
            <p><span className="text-muted-foreground">Vendor:</span> {t.supplier?.name ?? "—"}</p>
            {t.vendorRmaRef && <p><span className="text-muted-foreground">Vendor RMA ref:</span> {t.vendorRmaRef}</p>}
            <p><span className="text-muted-foreground">Vendor charge:</span> {formatBDT(t.vendorCharge)}</p>
            {t.eta && <p><span className="text-muted-foreground">ETA:</span> {new Date(t.eta).toLocaleDateString("en-GB")}</p>}
            {t.closedAt && <p><span className="text-muted-foreground">Closed:</span> {formatDateTime(t.closedAt)}</p>}
          </CardContent>
        </Card>

        {/* Stage actions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Stage actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isClosed ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center py-4"><Check className="inline h-5 w-5 mr-1" /> RMA closed. Unit delivered to customer.</p>
            ) : (
              <>
                {nextStage && (
                  <Button className="w-full" onClick={() => transition(nextStage)} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Advance to {nextStage.replace(/_/g, " ")}
                  </Button>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">Transition note (required for skip-stage)</Label>
                  <Textarea id="notes" value={transitionNotes} onChange={(e) => setTransitionNotes(e.target.value)} placeholder="Notes for this transition…" rows={2} />
                </div>
                {/* Skip-stage: allow jumping to any future stage */}
                {STAGES.slice(currentStageIndex + 2).map((s) => (
                  <Button key={s} variant="outline" className="w-full" onClick={() => transition(s)} disabled={busy || !transitionNotes}>
                    Skip to {s.replace(/_/g, " ")}
                  </Button>
                ))}
                {/* Quick close */}
                <Button variant="destructive" className="w-full" onClick={() => transition("DELIVERED_TO_CUSTOMER")} disabled={busy}>
                  <Check className="mr-2 h-4 w-4" /> Close (Delivered to customer)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stage history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Stage history ({t.history.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto scroll-area-thin">
            {t.history.map((h: any, i: number) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${i === t.history.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  {i < t.history.length - 1 && <div className="w-0.5 flex-1 bg-muted-foreground/20 min-h-[24px]" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={STAGE_TONE[h.stage] ?? ""} variant="secondary">{h.stage.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.timestamp)}</span>
                  </div>
                  {h.notes && <p className="text-sm text-muted-foreground mt-1">{h.notes}</p>}
                  <p className="text-xs text-muted-foreground">By {h.actorName}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
