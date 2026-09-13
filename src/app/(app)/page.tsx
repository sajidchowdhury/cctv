"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
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
  AlertTriangle,
  TrendingUp,
  Package,
} from "lucide-react";
import { formatBDT } from "@/lib/format";
import { useTranslation } from "@/lib/lang-store";
import { OnboardingBanner } from "@/components/layout/onboarding-banner";

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
  { href: "/stock", label: "Stock", icon: Package, phase: "S09" },
  { href: "/ledger", label: "Ledger", icon: BookOpen, phase: "S15" },
  { href: "/rma", label: "RMA", icon: Wrench, phase: "S21" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();

  const { data: stockData } = useQuery({
    queryKey: ["stock-summary-dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/reports/stock-summary");
      return await r.json();
    },
    enabled: status === "authenticated" && session?.user?.role !== "SUPER_ADMIN",
  });

  const { data: dueReminders } = useQuery({
    queryKey: ["reminders-due-today"],
    queryFn: async () => (await (await fetch("/api/reminders/due-today")).json()),
    enabled: status === "authenticated" && session?.user?.role !== "SUPER_ADMIN",
  });

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="h-7 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!session?.user) return null;
  const u = session.user;

  const totals = stockData?.totals;
  const lowStockItems = (stockData?.rows ?? []).filter((r: any) => r.lowStock).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("dashboard.welcome")}, ${u.name}`}
        description={t("dashboard.overview")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/payment">
              <CreditCard className="mr-2 h-4 w-4" /> {t("dashboard.subscription")}
            </Link>
          </Button>
        }
      />

      {/* Onboarding banner (S25) */}
      <OnboardingBanner />

      {/* Stock snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> {t("dashboard.stockValue")}
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatBDT(totals?.totalValue ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" /> {t("dashboard.unitsOnHand")}
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{totals?.totalUnits ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("dashboard.lowStockItems")}
            </CardDescription>
            <CardTitle className={`text-xl tabular-nums ${(totals?.lowStockCount ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {totals?.lowStockCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" /> {t("dashboard.subscription")}
            </CardDescription>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
              </span>
              <Badge className={STATUS_TONE[u.subscriptionStatus ?? ""] ?? ""} variant="secondary">
                {u.subscriptionStatus ?? "—"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.quickActions")}</CardTitle>
          <CardDescription>Jump into a module.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
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
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Low stock + reminders widgets */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{t("dashboard.lowStock")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/stock">{t("dashboard.viewAll")} <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={t("dashboard.noLowStock")}
                description="All products are above their safety stock threshold."
              />
            ) : (
              <ul className="space-y-2">
                {lowStockItems.map((item: any) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/products/${item.id}`} className="text-sm font-medium hover:underline truncate block">
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.sku} · {item.categoryName ?? "Uncategorised"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {item.onHand}/{item.safetyStock}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">restock {item.deficit}+</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{t("dashboard.upcomingReminders")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reminders">{t("dashboard.viewAll")} <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!dueReminders || dueReminders.count === 0) ? (
              <EmptyState
                icon={Bell}
                title={t("dashboard.noReminders")}
                description={t("dashboard.allCaughtUp")}
              />
            ) : (
              <ul className="space-y-2">
                {dueReminders.reminders.slice(0, 5).map((item: any) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <Link href="/reminders" className="text-sm font-medium hover:underline truncate block">
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.type.replace(/_/g, " ")}{item.amount ? ` · ৳${item.amount.toFixed(2)}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.overdue ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          {item.hoursLate > 24 ? `${Math.floor(item.hoursLate / 24)}d late` : `${item.hoursLate}h late`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Due today
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
