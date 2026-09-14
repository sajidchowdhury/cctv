"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";

type Supplier = { id: string; name: string; currentBalance: number };
type Invoice = { id: string; ref: string; date: string; total: number; paid: number; due: number };

export default function NewPaymentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [adjustment, setAdjustment] = useState("");
  const [narration, setNarration] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetch("/cctv/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  useEffect(() => {
    if (!supplierId) { setInvoices([]); return; }
    fetch(`/cctv/api/invoices/open?type=supplier&partyId=${supplierId}`).then((r) => r.json()).then((d) => setInvoices(d.invoices ?? []));
  }, [supplierId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/cctv/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          amount: Number(amount),
          mode,
          date,
          adjustment: Number(adjustment) || 0,
          narration: narration || null,
          invoiceIds: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create payment.", variant: "destructive" });
      } else {
        toast({ title: "Payment recorded", description: data.message });
        router.push("/ledger");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New payment"
        description="Supplier money-out with FIFO invoice settlement (doc §4.5)."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/ledger"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader><CardTitle className="text-base">Payment details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({formatBDT(s.currentBalance)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount paid (BDT) *</Label>
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
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adjustment">Adjustment (discount/round-off)</Label>
                <Input id="adjustment" type="number" step="0.01" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="narration">Narration (cheque no., reference)</Label>
              <Textarea id="narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Cheque no. / note" />
            </div>

            {supplierId && invoices.length > 0 && (
              <div className="space-y-2">
                <Label>Open invoices (FIFO auto-allocate)</Label>
                <div className="rounded-lg border max-h-48 overflow-y-auto scroll-area-thin">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border-b last:border-0 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{inv.ref}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatBDT(inv.due)}</p>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{formatBDT(inv.due)}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Amount is auto-allocated oldest-first. Residual = advance.</p>
              </div>
            )}
            {supplierId && invoices.length === 0 && (
              <p className="text-xs text-muted-foreground">No open invoices for this supplier. Payment will be stored as advance.</p>
            )}

            <Button type="submit" disabled={saving || !supplierId || !amount}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save payment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
