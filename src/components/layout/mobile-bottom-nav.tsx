"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";
import { useLanguage } from "@/lib/lang-store";

/**
 * Mobile bottom navigation (doc §6).
 * Thumb-reachable, ≥44px targets, 5 slots: Home · Sales · Purchase · Ledger · Products.
 * Respects iOS safe-area (pb-safe).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card pb-safe"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/cctv/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{lang === "bn" ? item.labelBn : item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
