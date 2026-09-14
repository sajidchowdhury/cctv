"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, LogOut, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Unlock, Settings } from "lucide-react";
import Link from "next/link";
import { formatBDT, formatDateTime } from "@/lib/format";

type QueueItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  method: string;
  txnId: string;
  amount: number;
  paidDate: string;
  senderNumber: string | null;
  status: string;
  submittedAt: string;
  ageMinutes: number;
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function AdminVerificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<QueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/cctv/api/admin/verifications?status=${filter}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated") {
      void load();
    }
  }, [status, load, router]);

  async function verify(item: QueueItem) {
    setActioning(item.id);
    try {
      const res = await fetch(`/cctv/api/admin/verifications/${item.id}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(`Verify failed: ${data.error}`);
      } else {
        setToast(`✓ ${item.tenantName} verified. Subscription extended 30 days.`);
        void load();
      }
    } finally {
      setActioning(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function confirmReject() {
    if (!rejectItem) return;
    setActioning(rejectItem.id);
    try {
      const res = await fetch(`/cctv/api/admin/verifications/${rejectItem.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(`Reject failed: ${data.error}`);
      } else {
        setToast(`✓ ${rejectItem.tenantName} rejected. User notified.`);
        setRejectItem(null);
        setRejectReason("");
        void load();
      }
    } finally {
      setActioning(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function unlock(tenantId: string, tenantName: string) {
    if (!confirm(`Unlock ${tenantName} with 7-day grace extension?`)) return;
    setActioning(tenantId);
    try {
      const res = await fetch(`/cctv/api/admin/tenants/${tenantId}/unlock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(`Unlock failed: ${data.error}`);
      } else {
        setToast(`✓ ${tenantName} unlocked with 7-day grace.`);
        void load();
      }
    } finally {
      setActioning(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    router.push("/admin/login");
    return null;
  }
  const admin = session.user;

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
              <p className="text-[11px] text-muted-foreground">{admin.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/admin/login", redirect: false })}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Payment verifications</h1>
            <p className="text-sm text-muted-foreground">
              Cross-check the transaction ID against your wallet/bank statement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {toast && (
          <div className="rounded-lg border bg-card px-4 py-3 text-sm" role="status">{toast}</div>
        )}

        {queue.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-medium">No {filter.toLowerCase()} verifications</p>
              <p className="text-sm text-muted-foreground mt-1">The queue is clear.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <Card key={item.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_TONE[item.status] ?? ""} variant="secondary">{item.status}</Badge>
                        <span className="font-semibold">{item.tenantName}</span>
                        {item.ageMinutes > 1440 && item.status === "PENDING" && (
                          <Badge variant="outline" className="text-amber-600">
                            <Clock className="h-3 w-3 mr-1" />
                            {Math.floor(item.ageMinutes / 1440)}d waiting
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <Field label="Amount" value={formatBDT(item.amount)} />
                        <Field label="Method" value={item.method} />
                        <Field label="Paid" value={formatDateTime(item.paidDate)} />
                        <Field label="Submitted" value={formatDateTime(item.submittedAt)} />
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Txn ID:</span> <code className="rounded bg-muted px-1.5 py-0.5">{item.txnId}</code></p>
                        <p><span className="text-muted-foreground">Sender:</span> {item.senderNumber ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.ownerEmail} · {item.ownerPhone ?? "no phone"}</p>
                      </div>
                    </div>
                    {item.status === "PENDING" && (
                      <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => verify(item)} disabled={actioning === item.id}>
                          {actioning === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="ml-2">Verify</span>
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setRejectItem(item)} disabled={actioning === item.id}>
                          <XCircle className="h-4 w-4" /><span className="ml-2">Reject</span>
                        </Button>
                      </div>
                    )}
                    {item.status === "VERIFIED" && (
                      <div className="shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    )}
                    {item.status === "REJECTED" && (
                      <div className="shrink-0">
                        <XCircle className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  {item.status !== "PENDING" && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-end">
                      <Button size="sm" variant="outline" onClick={() => unlock(item.tenantId, item.tenantName)} disabled={actioning === item.tenantId}>
                        <Unlock className="h-3 w-3 mr-1" /> Manual unlock (7d grace)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground">
          Admin Control Plane · CCTV Inventory SaaS
        </div>
      </footer>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectItem} onOpenChange={(o) => !o && setRejectItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              {rejectItem?.tenantName} · Txn {rejectItem?.txnId}. A reason is required —
              the user will be SMS-notified to retry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Transaction ID not found in wallet statement" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={rejectReason.length < 3 || actioning === rejectItem?.id}>
              {actioning === rejectItem?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
