/**
 * (app) route group layout — wires the AppShell (doc §6).
 *
 * Authenticated, tenant-scoped, role-guarded (S03 proxy enforces login +
 * locked-tenant gate). Every module page renders inside this shell:
 *   - desktop sidebar + mobile bottom nav
 *   - subscription banner slot
 *   - sticky footer
 *
 * CRITICAL: Sets Cache-Control: no-store on all (app) pages so the browser
 * NEVER caches authenticated content. Without this, after logout the browser
 * can serve a cached dashboard page directly (bypassing the middleware),
 * making it appear like the user is still logged in.
 */
import { AppShell } from "@/components/layout/app-shell";
import { headers } from "next/headers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force no-store cache headers on all authenticated pages.
  const headerList = await headers();
  headerList.set("Cache-Control", "no-store, no-cache, must-revalidate");

  return <AppShell>{children}</AppShell>;
}
