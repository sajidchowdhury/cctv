"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Store, Package, Truck, ShoppingCart, ArrowRight } from "lucide-react";

const STEPS = [
  { key: "profile", label: "Business profile", href: "/payment", icon: Store, desc: "Set your business name, phone, address" },
  { key: "products", label: "Add products", href: "/products/new", icon: Package, desc: "Create your first CCTV product" },
  { key: "suppliers", label: "Add suppliers", href: "/suppliers/new", icon: Truck, desc: "Add vendors you purchase from" },
  { key: "firstSale", label: "First sale", href: "/sales/new", icon: ShoppingCart, desc: "Record your first invoice" },
];

export function OnboardingBanner() {
  const { data } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => (await (await fetch("/api/onboarding/status")).json()),
  });

  if (!data || data.completed) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium text-sm">Complete your setup ({data.completedCount}/{data.totalSteps})</p>
            <p className="text-xs text-muted-foreground">Follow these steps to get your workspace ready.</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">{data.completedCount}/{data.totalSteps}</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STEPS.map((step) => {
            const done = data.steps?.[step.key];
            const Icon = step.icon;
            return (
              <Link
                key={step.key}
                href={step.href}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${done ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900" : "hover:bg-accent"}`}
              >
                {done ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Icon className="h-6 w-6 text-muted-foreground" />
                )}
                <span className={`text-xs font-medium ${done ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{step.label}</span>
                {!done && <span className="text-[10px] text-muted-foreground">{step.desc}</span>}
                {done && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Done</span>}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
