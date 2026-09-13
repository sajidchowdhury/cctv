/**
 * Root page (/) — Session S01 bootstrap placeholder.
 *
 * Replaced by the dashboard in S04. For now confirms the dev server boots
 * and the project is wired. No auth, no tenant context yet.
 */
import { ShieldCheck, Package, ShoppingCart, BookOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            CCTV Inventory SaaS
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-tenant inventory, sales, accounting &amp; reminder platform
            for CCTV businesses in Bangladesh.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Session S01 — Project Bootstrap
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>Next.js 16 + TypeScript 5 + Tailwind 4</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span>shadcn/ui + Prisma + NextAuth</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span>Folder contract &amp; adapters established</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Next up: S02 — Database Schema, Prisma &amp; Tenant Isolation
        </p>
      </div>
    </main>
  );
}
