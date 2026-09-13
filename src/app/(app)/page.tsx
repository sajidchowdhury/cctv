"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import {
  Boxes,
  ShoppingCart,
  PackagePlus,
  BookOpen,
  LayoutDashboard,
  CreditCard,
  Bell,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { formatBDT } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  GRACE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOCKED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING_ACTIVATION: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

const QUICK_LINKS = [
  { href: "/sales", label: "New Sale", icon: ShoppingCart, phase: "S11" },
  { href: "/purchases", label: "New Purchase", icon: PackagePlus, phase: "S08" },
  { href: "/products", label: "Products", icon: Boxes, phase: "S06" },
  { href: "/ledger", label: "Ledger", icon: BookOpen, phase: "S15" },
  { href: "/rma", label: "RMA", icon: Wrench, phase: "S21" },
  { href: "/reminders", label: "Reminders", icon: Bell, phase: "S22" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!session?.user) return null;
  const u = session.user;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${u.name}`}
        description="Your workspace is ready. Modules fill in over the coming sessions."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/payment">
              <CreditCard className="mr-2 h-4 w-4" /> Billing
            </Link>
          </Button>
        }
      />

      {/* Account + subscription snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Role</CardDescription>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" /> {u.role}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Subscription</CardDescription>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Plan
              </span>
              <Badge className={STATUS_TONE[u.subscriptionStatus] ?? ""} variant="secondary">
                {u.subscriptionStatus}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly fee</CardDescription>
            <CardTitle className="text-base">{formatBDT(500)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Email</CardDescription>
            <CardTitle className="text-sm font-medium truncate" title={u.email}>
              {u.email}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
          <CardDescription>Jump into a module (lands across S06–S22).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK_LINKS.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground min-h-[88px]"
                >
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground" />
                  <span className="text-xs font-medium">{q.label}</span>
                  <span className="text-[10px] text-muted-foreground">{q.phase}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Empty placeholder widgets — wired in later sessions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock</CardTitle>
            <CardDescription>Items at or below safety stock (S09).</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Boxes}
              title="No low-stock alerts"
              description="Stock summary lands in Session S09. Add products in S06 to see alerts here."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming reminders</CardTitle>
            <CardDescription>Due today + warranty expiries (S22).</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Bell}
              title="No reminders yet"
              description="The reminder engine lands in Session S22."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/reminders">
                    Go to reminders <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground pt-2">
        Session S04 — base UI shell established. Next sessions add module data.
      </p>
    </div>
  );
}
