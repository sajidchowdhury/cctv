"use client";

import { DesktopSidebar, MobileTopBar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SubscriptionBanner } from "./subscription-banner";

/**
 * AppShell — the mobile-first authenticated layout (doc §6).
 *
 * Structure:
 *   - Desktop: fixed sidebar (left) + main content + sticky footer
 *   - Mobile:  sticky top bar + main content + fixed bottom nav (5 slots)
 *   - Subscription banner slot (GRACE / PENDING_ACTIVATION)
 *   - Sticky footer at viewport bottom on short pages, pushed down on long
 *
 * Role-aware nav: SALESMAN doesn't see Ledger/Reports (visibleNavItems).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MobileTopBar />
      <SubscriptionBanner />
      <DesktopSidebar />

      <main className="flex-1 md:pl-64 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">{children}</div>
      </main>

      <footer className="mt-auto border-t bg-card md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-muted-foreground">
          CCTV Inventory SaaS · Phase P0 · Session S04
        </div>
      </footer>

      <MobileBottomNav />
    </div>
  );
}
