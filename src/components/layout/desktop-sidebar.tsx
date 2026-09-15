"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "@/lib/nav";
import { appPath } from "@/lib/app-path";
import { ShieldCheck, LogOut, Sun, Moon, Languages, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/lang-store";

/**
 * Desktop sidebar — full module list + brand + user + theme toggle (doc §6).
 * Hidden on mobile (bottom nav takes over).
 * Phase F-S1: shows business name + logo from the business profile.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { lang, toggle } = useLanguage();
  const role = session?.user?.role;
  const items = visibleNavItems(role as any);

  // Fetch business profile for business name + logo.
  const { data: profile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const r = await fetch("/cctv/api/business-profile");
      if (!r.ok) return null;
      const data = await r.json();
      return data.profile;
    },
    enabled: !!session?.user?.tenantId,
  });

  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;

  return (
    <aside className="hidden md:flex md:w-[var(--sidebar-width)] md:flex-col md:fixed md:inset-y-0 border-r bg-sidebar">
      <Link href="/settings" className="flex items-center gap-2 h-16 px-6 border-b hover:bg-sidebar-accent/50 transition-colors">
        {businessLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={businessLogo} alt="Logo" className="h-9 w-9 rounded-xl object-contain" />
        ) : (
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
        )}
        <div className="leading-tight min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{businessName}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {session?.user?.name ?? "User"}
          </p>
        </div>
        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

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
                  <span className="flex-1">{lang === "bn" ? item.labelBn : item.label}</span>
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
          onClick={() => toggle()}
        >
          <Languages className="mr-2 h-4 w-4" />
          {lang === "en" ? "বাংলা" : "English"}
        </Button>
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
          onClick={() => signOut({ callbackUrl: appPath("/login") })}
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
  const { lang, toggle } = useLanguage();
  const { data: session } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const r = await fetch("/cctv/api/business-profile");
      if (!r.ok) return null;
      const data = await r.json();
      return data.profile;
    },
    enabled: !!session?.user?.tenantId,
  });
  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;
  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4">
      <Link href="/settings" className="flex items-center gap-2">
        {businessLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={businessLogo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
        )}
        <span className="font-semibold text-sm truncate max-w-[120px]">{businessName}</span>
      </Link>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs font-medium"
          onClick={() => toggle()}
        >
          <Languages className="mr-1 h-4 w-4" />
          {lang === "en" ? "বাংলা" : "EN"}
        </Button>
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
