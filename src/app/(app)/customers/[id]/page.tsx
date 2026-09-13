"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { ArrowLeft, Save, Trash2, Loader2, Phone, MapPin, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate } from "@/lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [formLoaded, setFormLoaded] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await (await fetch(`/api/customers/${id}`)).json()).customer,
    enabled: !!id,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["customer-ledger", id],
    queryFn: async () => (await (await fetch(`/api/customers/${id}/ledger`)).json()),
    enabled: !!id,
  });

  // F5-S2: sync form via useEffect (was render-time setState — anti-pattern).
  useEffect(() => {
    if (detail && !formLoaded) {
      setForm({
        name: detail.name,
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        type: detail.type ?? "RETAIL",
        openingBalance: String(detail.openingBalance ?? 0),
      });
      setFormLoaded(true);
    }
  }, [detail, formLoaded]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          type: form.type,
          openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Update failed.", variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Customer updated." });
        qc.invalidateQueries({ queryKey: ["customer", id] });
        qc.invalidateQueries({ queryKey: ["customer-ledger", id] });
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted", description: "Customer removed." });
      router.push("/customers");
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!detail) return <p className="text-muted-foreground">Customer not found.</p>;

  const bal = detail.currentBalance;
  const ledger = ledgerData?.ledger ?? [];
  const sales = detail.sales ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={<Badge variant="outline">{detail.type}</Badge> as any}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Opening balance</p><p className="text-xl font-bold tabular-nums">{formatBDT(detail.openingBalance)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Current balance</p><p className={`text-xl font-bold tabular-nums ${bal > 0 ? "text-amber-600 dark:text-amber-400" : bal < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{formatBDT(bal)}</p></CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Status</p>
          {bal > 0 ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Receivable</Badge>
           : bal < 0 ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Advance</Badge>
           : <Badge variant="secondary">Settled</Badge>}
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {detail.phone}</p>}
            {detail.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {detail.address}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Edit</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type ?? "RETAIL"} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="RETAIL">Retail</SelectItem><SelectItem value="INSTALLER">Installer</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="openingBalance">Opening balance (BDT)</Label><Input id="openingBalance" type="number" step="0.01" value={form.openingBalance ?? ""} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} /></div>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent sales ({sales.length})</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sales yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left font-medium px-3 py-2">Invoice</th><th className="text-left font-medium px-3 py-2">Date</th><th className="text-right font-medium px-3 py-2">Total</th><th className="text-right font-medium px-3 py-2">Due</th></tr></thead>
                <tbody>
                  {sales.slice(0, 5).map((s: any) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2"><Link href={`/sales/${s.id}`} className="font-medium hover:underline">{s.invoiceNo}</Link></td>
                      <td className="px-3 py-2">{formatDate(s.date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBDT(s.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.due > 0 ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{formatBDT(s.due)}</Badge> : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Ledger</CardTitle></CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left font-medium px-3 py-2">Date</th><th className="text-left font-medium px-3 py-2">Type</th><th className="text-left font-medium px-3 py-2">Reference</th><th className="text-right font-medium px-3 py-2">Debit</th><th className="text-right font-medium px-3 py-2">Credit</th><th className="text-right font-medium px-3 py-2">Balance</th></tr></thead>
                <tbody>
                  {ledger.map((e: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={e.type === "OPENING" ? "border-sky-300 text-sky-700" : e.type === "SALE" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>{e.type}</Badge></td>
                      <td className="px-3 py-2">{e.ref}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.debitDisplay}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.creditDisplay}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{e.balanceDisplay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete customer</Button>}
          title="Delete this customer?"
          description="Soft-deleted — data preserved. Sales + receipts remain."
          destructive
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}
