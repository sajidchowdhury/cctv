"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/app-path";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, CreditCard, Loader2, ArrowRight, LogOut, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";

type HistoryItem = {
  id: string;
  method: string;
  txnId: string;
  amount: number;
  paidDate: string;
  senderNumber: string | null;
  status: string;
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

type Subscription = {
  status: string;
  cycleEnd: string;
  startedAt: string;
  plan: string;
} | null;

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  GRACE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOCKED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING_ACTIVATION: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

const PV_TONE: Record<string, string> = {
  PENDING: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function PaymentPage() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({
    method: "BKASH" as "BKASH" | "NAGAD" | "BANK",
    txnId: "",
    amount: 500,
    paidDate: new Date().toISOString().slice(0, 10),
    senderNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [loading, setLoading] = useState(true);
  // F6-S1: payment settings (bkashNumber, nagadNumber, bankDetails, monthlyFee)
  const [settings, setSettings] = useState<{
    bkashNumber: string | null;
    nagadNumber: string | null;
    bankDetails: string | null;
    monthlyFee: number;
    monthlyFeeDisplay: string;
  } | null>(null);

  async function loadHistory() {
    setLoading(true);
    try {
      const [histRes, setRes] = await Promise.all([
        fetch("/cctv/api/billing/history"),
        fetch("/cctv/api/billing/settings"),
      ]);
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history);
        setSubscription(data.subscription);
      }
      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData.settings) {
          setSettings(setData.settings);
          // Update the form's amount default to the configured fee.
          setForm((f) => ({ ...f, amount: setData.settings.monthlyFee ?? 500 }));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/cctv/api/billing/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed.");
        setSubmitting(false);
        return;
      }
      setSuccess("Payment submitted. Awaiting admin verification.");
      setForm((f) => ({ ...f, txnId: "", senderNumber: "" }));
      void loadHistory();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const subStatus = subscription?.status ?? session?.user?.subscriptionStatus ?? "PENDING_ACTIVATION";

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Lock className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">Subscription</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: appPath("/login") })}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 space-y-6">
        {/* Status banner */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Current status</p>
                <Badge className={STATUS_TONE[subStatus] ?? ""} variant="secondary">
                  {subStatus}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Cycle ends</p>
                <p className="font-semibold text-sm">
                  {subscription?.cycleEnd ? formatDate(subscription.cycleEnd) : "—"}
                </p>
              </div>
            </div>
            {(subStatus === "LOCKED" || subStatus === "PENDING_ACTIVATION") && (
              <p className="text-sm text-muted-foreground mt-3">
                Your account is {subStatus === "LOCKED" ? "locked" : "pending activation"}.
                Submit a payment below — the admin verifies your transaction ID and
                access is restored within 60 seconds.
              </p>
            )}
            {subStatus === "ACTIVE" && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Subscription active. You can submit a renewal early.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5" /> Submit payment
            </CardTitle>
            <CardDescription>
              Pay {settings?.monthlyFeeDisplay ?? "BDT 500"} to the admin&apos;s bKash / Nagad / Bank number below, then
              enter the transaction ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {/* F6-S1: payment instructions card — show configured numbers */}
              {settings && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Send money to</p>
                  {settings.bkashNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">bKash</span>
                      <span className="font-mono font-medium">{settings.bkashNumber}</span>
                    </div>
                  )}
                  {settings.nagadNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Nagad</span>
                      <span className="font-mono font-medium">{settings.nagadNumber}</span>
                    </div>
                  )}
                  {settings.bankDetails && (
                    <div className="border-t pt-2">
                      <span className="text-muted-foreground block mb-1">Bank</span>
                      <pre className="whitespace-pre-wrap font-mono text-xs">{settings.bankDetails}</pre>
                    </div>
                  )}
                  {!settings.bkashNumber && !settings.nagadNumber && !settings.bankDetails && (
                    <p className="text-xs text-muted-foreground italic">Payment numbers not yet configured by admin.</p>
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground">Monthly fee</span>
                    <span className="font-bold tabular-nums">{settings.monthlyFeeDisplay}</span>
                  </div>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Payment method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v as any }))}>
                    <SelectTrigger id="method"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BKASH">bKash</SelectItem>
                      <SelectItem value="NAGAD">Nagad</SelectItem>
                      <SelectItem value="BANK">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (BDT)</Label>
                  <Input id="amount" type="number" min={1} step="0.01" required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="txnId">Transaction ID</Label>
                <Input id="txnId" required value={form.txnId}
                  onChange={(e) => setForm((f) => ({ ...f, txnId: e.target.value }))}
                  placeholder="e.g. 9X8K7L6M5N" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paidDate">Payment date</Label>
                  <Input id="paidDate" type="date" required value={form.paidDate}
                    onChange={(e) => setForm((f) => ({ ...f, paidDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderNumber">Sender number</Label>
                  <Input id="senderNumber" value={form.senderNumber}
                    onChange={(e) => setForm((f) => ({ ...f, senderNumber: e.target.value }))}
                    placeholder="01XXXXXXXXX" />
                </div>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              {success && <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">{success}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit payment
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
            <CardDescription>Your submissions and their verification status.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No payments submitted yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={PV_TONE[h.status] ?? ""} variant="secondary">{h.status}</Badge>
                        <span className="font-medium text-sm">{formatBDT(h.amount)}</span>
                        <span className="text-xs text-muted-foreground">{h.method}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Txn: {h.txnId} · Paid {formatDate(h.paidDate)}
                      </p>
                      {h.status === "REJECTED" && h.rejectionReason && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {h.rejectionReason}
                        </p>
                      )}
                      {h.status === "VERIFIED" && h.verifiedAt && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Verified {formatDate(h.verifiedAt)}
                        </p>
                      )}
                      {h.status === "PENDING" && (
                        <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Awaiting admin verification
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {subStatus === "ACTIVE" && (
          <div className="text-center">
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        )}
      </section>

      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-2xl px-4 py-4 text-center text-xs text-muted-foreground">
          CCTV Inventory SaaS · {settings?.monthlyFeeDisplay ?? "BDT 500"}/month flat plan
        </div>
      </footer>
    </main>
  );
}
