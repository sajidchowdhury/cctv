"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { ArrowLeft, Save, Trash2, Loader2, Phone, MapPin, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate } from "@/lib/format";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [formLoaded, setFormLoaded] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const r = await fetch(`/api/suppliers/${id}`);
      return (await r.json()).supplier;
    },
    enabled: !!id,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["supplier-ledger", id],
    queryFn: async () => {
      const r = await fetch(`/api/suppliers/${id}/ledger`);
      return await r.json();
    },
    enabled: !!id,
  });

  // F5-S2: sync form via useEffect (was render-time setState — anti-pattern).
  useEffect(() => {
    if (detail && !formLoaded) {
      setForm({
        name: detail.name,
        phone: detail.phone ?? "",
        company: detail.company ?? "",
        address: detail.address ?? "",
        openingBalance: String(detail.openingBalance ?? 0),
      });
      setFormLoaded(true);
    }
  }, [detail, formLoaded]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          company: form.company || null,
          address: form.address || null,
          openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Update failed.", variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Supplier updated." });
        qc.invalidateQueries({ queryKey: ["supplier", id] });
        qc.invalidateQueries({ queryKey: ["suppliers"] });
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted", description: "Supplier removed." });
      router.push("/suppliers");
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!detail) return <p className="text-muted-foreground">Supplier not found.</p>;

  const bal = detail.currentBalance;
  const ledger = ledgerData?.ledger ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={detail.company ?? "Supplier"}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/suppliers"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Opening balance</p><p className="text-xl font-bold tabular-nums">{formatBDT(detail.openingBalance)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Current balance</p><p className={`text-xl font-bold tabular-nums ${bal > 0 ? "text-amber-600 dark:text-amber-400" : bal < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{formatBDT(bal)}</p></CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Status</p>
          {bal > 0 ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Payable</Badge>
           : bal < 0 ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Advance</Badge>
           : <Badge variant="secondary">Settled</Badge>}
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact + edit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {detail.phone}</p>}
            {detail.company && <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {detail.company}</p>}
            {detail.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {detail.address}</p>}
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit supplier</CardTitle>
            <CardDescription>Changing opening balance adjusts current balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="openingBalance">Opening balance (BDT)</Label><Input id="openingBalance" type="number" step="0.01" value={form.openingBalance ?? ""} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} /></div>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Ledger preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger</CardTitle>
          <CardDescription>Opening + purchases (debit) − payments (credit).</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet. Purchases land in S08; payments in S16.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Reference</th>
                    <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Debit</th>
                    <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Credit</th>
                    <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e: any, i: number) => (
                    <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          e.type === "OPENING" ? "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400" :
                          e.type === "PURCHASE" ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400" :
                          "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                        }>{e.type}</Badge>
                      </td>
                      <td className="px-4 py-3">{e.ref}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.debitDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e.creditDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{e.balanceDisplay}</td>
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
          trigger={<Button variant="outline" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete supplier</Button>}
          title="Delete this supplier?"
          description="Soft-deleted — data preserved. Existing purchase/payment records remain."
          destructive
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}
