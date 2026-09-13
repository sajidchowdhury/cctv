"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Subscription status banner (doc §3.3 lifecycle).
 * Shows when GRACE (X days to lockout) or PENDING_ACTIVATION.
 * LOCKED users never see this — the proxy redirects them to /payment.
 */
export function SubscriptionBanner() {
  const { data: session } = useSession();
  const status = session?.user?.subscriptionStatus;

  if (status === "ACTIVE") return null;
  if (status === "LOCKED") return null; // redirected by proxy

  const config = {
    PENDING_ACTIVATION: {
      icon: CreditCard,
      tone: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-900",
      msg: "Your account is pending activation. Submit your first payment to unlock all modules.",
    },
    GRACE: {
      icon: Clock,
      tone: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900",
      msg: "Subscription in grace period. Renew now to avoid lockout.",
    },
  } as const;

  const c = config[status as keyof typeof config];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <div className={cn("border-b px-4 py-2", c.tone)}>
      <div className="mx-auto max-w-5xl flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{c.msg}</span>
        <Link
          href="/payment"
          className="font-medium underline underline-offset-2 whitespace-nowrap"
        >
          Pay now
        </Link>
      </div>
    </div>
  );
}

/** A compact alert variant for the dashboard "locked soon" widget. */
export function GraceAlert({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{daysLeft} days to lockout — renew your subscription.</span>
    </div>
  );
}
