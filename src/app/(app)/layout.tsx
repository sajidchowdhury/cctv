/**
 * (app) route group layout — wires the AppShell (doc §6).
 *
 * Authenticated, tenant-scoped, role-guarded (S03 proxy enforces login +
 * locked-tenant gate). Every module page renders inside this shell:
 *   - desktop sidebar + mobile bottom nav
 *   - subscription banner slot
 *   - sticky footer
 */
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
