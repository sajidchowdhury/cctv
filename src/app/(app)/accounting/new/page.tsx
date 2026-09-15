"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Head = { id: string; name: string; kind: string };

export default function NewTransactionPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [heads, setHeads] = useState<Head[]>([]);
  const [type, setType] = useState("EXP");
  const [accountHeadId, setAccountHeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");

  useEffect(() => {
    fetch("/cctv/api/account-heads").then((r) => r.json()).then((d) => setHeads(d.accountHeads ?? []));
  }, []);

  const filteredHeads = heads.filter((h) => h.kind === type);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/cctv/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          accountHeadId: accountHeadId || null,
          amount: Number(amount),
          mode,
          date,
          narration: narration || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not save.", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Saved", description: `${type === "IN" ? "Income" : "Expense"} recorded.` });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      router.push("/ledger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New transaction"
        description="Record income or expense (single-entry cash-book style)."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/ledger"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction</CardTitle>
          <CardDescription>Doc §4.4 — lightweight ledger, not full double-entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setAccountHeadId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Income</SelectItem>
                  <SelectItem value="EXP">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account head</Label>
              <Select value={accountHeadId} onValueChange={setAccountHeadId}>
                <SelectTrigger><SelectValue placeholder="Select head…" /></SelectTrigger>
                <SelectContent>
                  {filteredHeads.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {filteredHeads.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No {type === "IN" ? "income" : "expense"} heads yet.{" "}
                  <Link href="/accounting/heads" className="underline">Add one →</Link>
                </p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (BDT) *</Label>
                <Input id="amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Payment mode</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK">Bank</SelectItem>
                    <SelectItem value="BKASH">bKash</SelectItem>
                    <SelectItem value="NAGAD">Nagad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="narration">Narration</Label>
              <Textarea id="narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Short note / bill ref" />
            </div>
            <Button type="submit" disabled={saving || !amount}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save transaction
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
