"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Plus, Loader2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

type Ticket = {
  id: string; rmaNo: string; dateOpened: string;
  customerName: string; productName: string; productModel: string | null;
  supplierName: string; faultReason: string; stage: string;
  vendorRmaRef: string | null; vendorCharge: number; eta: string | null;
  closedAt: string | null; historyCount: number; overdue: boolean; stageIndex: number;
};

const STAGES = ["RECEIVED_FROM_CUSTOMER", "SENT_TO_VENDOR", "UNDER_REPAIR", "RETURNED_FROM_VENDOR", "DELIVERED_TO_CUSTOMER"];
const STAGE_TONE: Record<string, string> = {
  RECEIVED_FROM_CUSTOMER: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  SENT_TO_VENDOR: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  UNDER_REPAIR: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  RETURNED_FROM_VENDOR: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  DELIVERED_TO_CUSTOMER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default function RmaPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["rma-tickets", search, stageFilter],
    queryFn: async () => (await (await fetch(`/cctv/api/rma?q=${encodeURIComponent(search)}${stageFilter ? `&stage=${stageFilter}` : ""}`)).json()).tickets as Ticket[],
  });
  const tickets = data ?? [];

  const openCount = tickets.filter((t) => t.stage !== "DELIVERED_TO_CUSTOMER").length;
  const overdueCount = tickets.filter((t) => t.overdue).length;
  const closedCount = tickets.filter((t) => t.stage === "DELIVERED_TO_CUSTOMER").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor RMA" description="5-stage repair pipeline with timestamped history (doc §5.7)." action={<Button asChild size="sm"><Link href="/rma/new"><Plus className="mr-2 h-4 w-4" /> New RMA</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Open</p><p className="text-xl font-bold tabular-nums">{openCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{overdueCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Closed</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{closedCount}</p></CardContent></Card>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchScanInput value={search} onChange={setSearch} placeholder="Search RMA number…" className="flex-1" />
        <div className="flex gap-1 flex-wrap">
          <Button variant={!stageFilter ? "default" : "outline"} size="sm" onClick={() => setStageFilter("")}>All</Button>
          {STAGES.map((s) => <Button key={s} variant={stageFilter === s ? "default" : "outline"} size="sm" onClick={() => setStageFilter(s)}>{s.replace(/_/g, " ").split(" ")[0]}</Button>)}
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12"><Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No RMA tickets yet. Open one when a customer returns a faulty unit.</p></div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/rma/${t.id}`} className="font-medium hover:underline">{t.rmaNo}</Link>
                      {t.overdue && <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>}
                      <Badge className={STAGE_TONE[t.stage] ?? ""} variant="secondary">{t.stage.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="mt-1 text-sm space-y-0.5">
                      <p><span className="text-muted-foreground">Customer:</span> {t.customerName} · <span className="text-muted-foreground">Product:</span> {t.productName}{t.productModel ? ` (${t.productModel})` : ""}</p>
                      <p className="text-muted-foreground">Fault: {t.faultReason}</p>
                      {t.supplierName !== "—" && <p className="text-muted-foreground">Vendor: {t.supplierName}{t.vendorRmaRef ? ` · Ref: ${t.vendorRmaRef}` : ""}</p>}
                      {t.eta && <p className="text-muted-foreground">ETA: {formatDate(t.eta)}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Opened: {formatDate(t.dateOpened)}</p>
                    <p className="text-xs text-muted-foreground">History: {t.historyCount} entries</p>
                    {/* Progress dots */}
                    <div className="flex gap-1 mt-2 justify-end">
                      {STAGES.map((s, i) => (
                        <div key={s} className={`h-2 w-6 rounded-full ${i <= t.stageIndex ? "bg-primary" : "bg-muted"}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
