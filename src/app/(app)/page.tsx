"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, LogOut, LayoutDashboard, CreditCard } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  GRACE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOCKED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING_ACTIVATION: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) return null;
  const u = session.user;

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-semibold">CCTV Inventory</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {u.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your workspace is ready. The module shell arrives in Session S04.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutDashboard className="h-4 w-4" /> Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Email" value={u.email} />
              <Row label="Role" value={u.role} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subscription</span>
                <Badge className={STATUS_TONE[u.subscriptionStatus] ?? ""} variant="secondary">
                  {u.subscriptionStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" /> Billing
              </CardTitle>
              <CardDescription>
                BDT 500/month flat plan (doc §3.2).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/payment">Manage subscription</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session S03 — Auth, RBAC</CardTitle>
            <CardDescription>
              Authenticated shell. Next sessions add the module navigation + data.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Credentials login + JWT session with subscription refresh</p>
            <p>• 1-email-per-account enforced (DB UNIQUE + friendly message)</p>
            <p>• Locked / pending tenants redirected to /payment</p>
            <p>• Role guard demo: <code className="rounded bg-muted px-1">GET /api/test/accounting</code> (ACCOUNTANT/OWNER only)</p>
          </CardContent>
        </Card>
      </section>

      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground">
          CCTV Inventory SaaS · Phase P0 · Session S03
        </div>
      </footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate ml-2">{value}</span>
    </div>
  );
}
