"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/lib/nav";
import { ShieldCheck, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Desktop sidebar — full module list + brand + user + theme toggle (doc §6).
 * Hidden on mobile (bottom nav takes over).
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const role = session?.user?.role;
  const items = visibleNavItems(role as any);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-sidebar">
      <div className="flex items-center gap-2 h-16 px-6 border-b">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-sm">CCTV Inventory</p>
          <p className="text-[11px] text-muted-foreground">
            {session?.user?.name ?? "User"}
          </p>
        </div>
      </div>

      <nav aria-label="Modules" className="flex-1 overflow-y-auto scroll-area-thin px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.phase && (
                    <span className="text-[10px] text-muted-foreground">
                      {item.phase}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-3 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start min-h-[44px]"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground min-h-[44px]"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>
    </aside>
  );
}

/** Mobile header brand bar (shown on <md where sidebar is hidden). */
export function MobileTopBar() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">CCTV Inventory</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Link
          href="/payment"
          className="inline-flex h-9 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Billing"
        >
          <ShieldCheck className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
