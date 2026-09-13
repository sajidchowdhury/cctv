"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPES = ["RENT", "ELECTRICITY", "INTERNET_GAS", "TRADELICENSE", "SALARY", "WARRANTY_EXPIRY", "LOW_STOCK", "FOLLOW_UP", "SUBSCRIPTION_BILL", "OTHER"];
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ONCE"];

export default function NewReminderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "RENT",
    title: "",
    amount: "",
    frequency: "MONTHLY",
    nextDue: new Date().toISOString().slice(0, 10),
    channel: "IN_APP_SMS",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type, title: form.title,
          amount: form.amount ? Number(form.amount) : null,
          frequency: form.frequency, nextDue: form.nextDue, channel: form.channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Failed", description: data.error, variant: "destructive" }); }
      else { toast({ title: "Reminder created" }); router.push("/reminders"); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New reminder" description="Bill renewals, salary, warranty expiry, etc. (doc §5.5)." action={<Button asChild variant="outline" size="sm"><Link href="/reminders"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base">Reminder details</CardTitle><CardDescription>The worker checks every minute + dispatches SMS.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Frequency</Label><Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="title">Title *</Label><Input id="title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Monthly shop rent" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="amount">Amount (BDT, optional)</Label><Input id="amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-2"><Label htmlFor="nextDue">Next due date *</Label><Input id="nextDue" type="date" required value={form.nextDue} onChange={(e) => setForm((f) => ({ ...f, nextDue: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Channel</Label><Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN_APP_SMS">In-app + SMS</SelectItem><SelectItem value="IN_APP">In-app only</SelectItem><SelectItem value="SMS">SMS only</SelectItem></SelectContent></Select></div>
            <Button type="submit" disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save reminder</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
