"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Loader2, Save, ShoppingCart, MessageSquare, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

const RATING_TONE: Record<string, string> = {
  HAPPY: "border-emerald-300 text-emerald-700",
  NEUTRAL: "border-slate-300 text-slate-700",
  UNHAPPY: "border-red-300 text-red-700",
};

export default function CrmCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [rating, setRating] = useState("NEUTRAL");
  const [nextDue, setNextDue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-customer-timeline", id],
    queryFn: async () => (await (await fetch(`/api/crm/customers/${id}/timeline`)).json()),
    enabled: !!id,
  });

  async function onAddFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: id, note, rating, nextDueDate: nextDue || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Follow-up added" });
        setNote(""); setNextDue("");
        qc.invalidateQueries({ queryKey: ["crm-customer-timeline", id] });
      }
    } finally { setSaving(false); }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">Customer not found.</p>;

  const c = data.customer;
  const timeline = data.timeline;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={<Badge variant="outline">{c.type}</Badge> as any}
        action={
          <div className="flex gap-2">
            {c.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${c.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></Button>}
            <Button asChild variant="outline" size="sm"><Link href="/crm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total spent</p><p className="text-xl font-bold tabular-nums">{formatBDT(c.totalSpent)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Purchases</p><p className="text-xl font-bold tabular-nums">{c.purchaseCount}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Balance</p><p className={`text-xl font-bold tabular-nums ${c.currentBalance > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(c.currentBalance)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{c.phone ?? "—"}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add follow-up */}
        <Card>
          <CardHeader><CardTitle className="text-base">Add follow-up</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onAddFollowUp} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="note">Note / feedback</Label><Textarea id="note" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer said…" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Rating</Label><Select value={rating} onValueChange={setRating}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HAPPY">Happy</SelectItem><SelectItem value="NEUTRAL">Neutral</SelectItem><SelectItem value="UNHAPPY">Unhappy</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="nextDue">Next follow-up</Label><Input id="nextDue" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></div>
              </div>
              <Button type="submit" disabled={saving || !note.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save follow-up</Button>
            </form>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Timeline ({timeline.length})</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area-thin">
                {timeline.slice(0, 20).map((item: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.type === "SALE" ? <ShoppingCart className="h-4 w-4 text-blue-500" /> : <MessageSquare className="h-4 w-4 text-violet-500" />}
                        <span className="font-medium text-sm">{item.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.date)}</span>
                    </div>
                    {item.type === "SALE" ? (
                      <div className="text-xs text-muted-foreground pl-6">
                        <p>{item.amountDisplay}</p>
                        {item.items?.slice(0, 3).map((it: any, j: number) => <p key={j}>{it.product} × {it.qty}</p>)}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground pl-6">
                        <p>{item.note}</p>
                        {item.nextDueDate && <p className="text-amber-600">Next: {formatDate(item.nextDueDate)}</p>}
                        <p>By {item.author}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
