"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Plus, Loader2, AlertTriangle, Clock, Check, Ban, Send } from "lucide-react";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type Reminder = {
  id: string; type: string; title: string; amount: number | null;
  frequency: string; nextDue: string; channel: string; active: boolean;
  refType: string | null; refId: string | null; overdue: boolean; daysUntilDue: number;
  lastDispatchedAt: string | null;
  dispatchCount: number;
  recentLogs: { channel: string; status: string; dispatchedAt: string }[];
};

const TYPE_TONE: Record<string, string> = {
  TRADELICENSE: "border-blue-300 text-blue-700",
  RENT: "border-amber-300 text-amber-700",
  ELECTRICITY: "border-yellow-300 text-yellow-700",
  INTERNET_GAS: "border-cyan-300 text-cyan-700",
  SALARY: "border-violet-300 text-violet-700",
  WARRANTY_EXPIRY: "border-emerald-300 text-emerald-700",
  LOW_STOCK: "border-red-300 text-red-700",
  FOLLOW_UP: "border-indigo-300 text-indigo-700",
  SERVICE_TICKET: "border-orange-300 text-orange-700",
  SUBSCRIPTION_BILL: "border-sky-300 text-sky-700",
  OTHER: "border-slate-300 text-slate-700",
};

export default function RemindersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reminders", typeFilter, showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (showInactive) params.set("active", "0");
      return (await (await fetch(`/cctv/api/reminders?${params}`)).json()).reminders as Reminder[];
    },
  });
  const reminders = data ?? [];

  async function snooze(id: string, days: number) {
    const newDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await fetch(`/cctv/api/reminders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextDue: newDate }),
    });
    if (res.ok) {
      toast({ title: `Snoozed ${days}d`, description: "Next due date updated." });
      qc.invalidateQueries({ queryKey: ["reminders"] });
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/cctv/api/reminders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  const overdueCount = reminders.filter((r) => r.overdue).length;
  const dueTodayCount = reminders.filter((r) => r.daysUntilDue <= 0 && !r.overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Reminders" description="Unified reminder engine + SMS dispatch (doc §5.5)." action={<Button asChild size="sm"><Link href="/reminders/new"><Plus className="mr-2 h-4 w-4" /> New reminder</Link></Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total active</p><p className="text-xl font-bold tabular-nums">{reminders.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{overdueCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Due today</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{dueTodayCount}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button variant={!typeFilter ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("")}>All</Button>
        {["RENT", "ELECTRICITY", "SALARY", "WARRANTY_EXPIRY", "SUBSCRIPTION_BILL", "OTHER"].map((t) => (
          <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)}>{t.replace(/_/g, " ")}</Button>
        ))}
        <Button variant={showInactive ? "default" : "ghost"} size="sm" onClick={() => setShowInactive(!showInactive)}>{showInactive ? "Showing all" : "Show inactive"}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-12"><Bell className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No reminders. Add one for rent, electricity, salary, etc.</p></div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={TYPE_TONE[r.type] ?? TYPE_TONE.OTHER}>{r.type.replace(/_/g, " ")}</Badge>
                      {r.overdue ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>
                      ) : r.daysUntilDue <= 0 ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Clock className="h-3 w-3 mr-1" />Due today</Badge>
                      ) : (
                        <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{r.daysUntilDue}d</Badge>
                      )}
                      {!r.active && <Badge variant="secondary" className="bg-slate-100 text-slate-500"><Ban className="h-3 w-3 mr-1" />Inactive</Badge>}
                    </div>
                    <p className="font-medium text-sm mt-1">{r.title}</p>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      {r.amount && <span>{formatBDT(r.amount)}</span>}
                      <span>Frequency: {r.frequency}</span>
                      <span>Next: {formatDate(r.nextDue)}</span>
                      <span>Channel: {r.channel}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => snooze(r.id, 1)}>+1d</Button>
                    <Button size="sm" variant="outline" onClick={() => snooze(r.id, 7)}>+7d</Button>
                    {r.active ? (
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(r.id, false)} className="text-muted-foreground"><Ban className="h-4 w-4" /></Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(r.id, true)} className="text-emerald-600"><Check className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>

                {/* Dispatch history (F3-S2) */}
                {r.dispatchCount > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    <div className="flex items-center gap-2">
                      <Send className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Dispatched {r.dispatchCount} time{r.dispatchCount !== 1 ? "s" : ""} · Last: {r.lastDispatchedAt ? formatDateTime(r.lastDispatchedAt) : "—"}
                      </span>
                    </div>
                    {r.recentLogs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.recentLogs.slice(0, 3).map((log, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {log.channel} · {log.status} · {formatDate(log.dispatchedAt)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
