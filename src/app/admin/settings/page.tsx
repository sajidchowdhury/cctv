"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/app-path";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, LogOut, Save, Loader2, ArrowLeft, CheckCircle2, Settings } from "lucide-react";

type Settings = {
  bkashNumber: string | null;
  nagadNumber: string | null;
  bankDetails: string | null;
  monthlyFee: number;
  monthlyFeeDisplay?: string;
};

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    bkashNumber: "",
    nagadNumber: "",
    bankDetails: "",
    monthlyFee: "500",
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      router.push("/admin/login");
      return;
    }
    load();
  }, [session, status, router]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/cctv/api/admin/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setForm({
          bkashNumber: data.settings.bkashNumber ?? "",
          nagadNumber: data.settings.nagadNumber ?? "",
          bankDetails: data.settings.bankDetails ?? "",
          monthlyFee: String(data.settings.monthlyFee ?? 500),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/cctv/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bkashNumber: form.bkashNumber.trim() || null,
          nagadNumber: form.nagadNumber.trim() || null,
          bankDetails: form.bankDetails.trim() || null,
          monthlyFee: Number(form.monthlyFee) || 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(`✗ ${data.error ?? "Save failed."}`);
        return;
      }
      setToast(`✓ ${data.message} Updated ${data.updatedTenants} tenant(s).`);
      // Reload to reflect the saved state.
      await load();
    } finally {
      setSaving(false);
      // Auto-clear toast after 4s.
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-sm">Admin Control Plane</p>
              <p className="text-[11px] text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => {
            await signOut({ redirect: false });
            window.location.href = appPath("/admin/login");
          }}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/verifications"><ArrowLeft className="mr-2 h-4 w-4" /> Verifications</Link>
          </Button>
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5" /> Payment settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the bKash/Nagad/Bank numbers + monthly fee shown to all tenants on the /payment page.
            Changes apply to ALL tenants immediately.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment numbers + fee</CardTitle>
            <CardDescription>
              These are displayed to users when they submit a payment. The monthly fee is also shown on the signup page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bkash">bKash number</Label>
                  <Input
                    id="bkash"
                    value={form.bkashNumber}
                    onChange={(e) => setForm({ ...form, bkashNumber: e.target.value })}
                    placeholder="e.g. 01712-345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nagad">Nagad number</Label>
                  <Input
                    id="nagad"
                    value={form.nagadNumber}
                    onChange={(e) => setForm({ ...form, nagadNumber: e.target.value })}
                    placeholder="e.g. 01812-345678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank">Bank account details</Label>
                <Textarea
                  id="bank"
                  rows={3}
                  value={form.bankDetails}
                  onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
                  placeholder={"e.g.\nBank: Dutch-Bangla Bank\nA/C: 1234567890123\nBranch: Dhanmondi-2"}
                />
                <p className="text-xs text-muted-foreground">Multi-line free text. Shown as-is on the /payment page.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee">Monthly fee (BDT)</Label>
                <Input
                  id="fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthlyFee}
                  onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Default: 500 BDT/month. Changing this updates the fee shown on /payment + signup pages for all tenants.
                </p>
              </div>

              {toast && (
                <div className={`rounded-lg border px-4 py-2 text-sm ${
                  toast.startsWith("✓")
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                    : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
                }`}>
                  {toast}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save settings
                </Button>
                {settings && (
                  <Badge variant="outline" className="ml-auto">
                    Current fee: {settings.monthlyFeeDisplay}
                  </Badge>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t bg-card mt-auto">
        <div className="mx-auto max-w-5xl px-4 py-3 text-center text-xs text-muted-foreground">
          CCTV Inventory SaaS · Admin Control Plane
        </div>
      </footer>
    </main>
  );
}
