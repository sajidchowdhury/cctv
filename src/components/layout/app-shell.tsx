"use client";

import { DesktopSidebar, MobileTopBar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SubscriptionBanner } from "./subscription-banner";

/**
 * AppShell — the mobile-first authenticated layout (doc §6).
 *
 * Structure:
 *   - Desktop: fixed sidebar (left, --sidebar-width) + main content + sticky footer
 *   - Mobile:  sticky top bar + main content + fixed bottom nav (5 slots)
 *   - Subscription banner slot (GRACE / PENDING_ACTIVATION)
 *   - Sticky footer at viewport bottom on short pages, pushed down on long
 *
 * F5-S1: content max-width bumped to max-w-7xl (1280px) for desktop premium feel;
 * responsive horizontal padding (px-4 → md:px-6 → lg:px-8); sidebar width
 * referenced via CSS var --sidebar-width (single source of truth) using Tailwind 4's
 * arbitrary value syntax: md:pl-[var(--sidebar-width)].
 *
 * Role-aware nav: SALESMAN doesn't see Ledger/Reports (visibleNavItems).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MobileTopBar />
      <SubscriptionBanner />
      <DesktopSidebar />

      {/* Sidebar offset only on md+; on mobile --sidebar-width is 0 so padding is 0 */}
      <main className="flex-1 pb-20 md:pb-0 md:pl-[var(--sidebar-width)]">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>

      <footer className="mt-auto border-t bg-card md:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-4 text-center text-xs text-muted-foreground">
          CCTV InventoryOS made with love &amp; coffee by{" "}
          <a
            href="https://mycreativecode.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            my creative code
          </a>
        </div>
      </footer>

      <MobileBottomNav />
    </div>
  );
}
