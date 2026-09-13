/**
 * Tenant Context — resolves the active tenant_id for the current request
 * and threads it through the Prisma client extension (RLS replication on SQLite).
 *
 * Doc §3.1: PostgreSQL RLS template
 *   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY tenant_isolation ON products
 *     USING (tenant_id = current_setting('app.tenant_id')::uuid);
 *
 * On SQLite there is no native RLS, so we replicate the guarantee with:
 *   1. AsyncLocalStorage — per-request tenant_id (set by S03 auth middleware)
 *   2. Prisma client extension — auto-filters every read by tenant_id and
 *      injects it on every create. A missed app filter can never leak.
 *
 * S02: context + extension are live; tenant_id is set explicitly via
 *      `runWithTenant()` for seed scripts + tests.
 * S03: NextAuth session middleware calls `runWithTenant()` automatically.
 */

import { AsyncLocalStorage } from "async_hooks";

/** Role enum — enforced on every API route + page (doc §3, §4). */
export type Role = "OWNER" | "MANAGER" | "SALESMAN" | "ACCOUNTANT";

/** Subscription lifecycle status (doc §3.3). */
export type SubscriptionStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "GRACE"
  | "LOCKED";

/**
 * Per-request tenant context. Survives async hops within a single request
 * without polluting global state across concurrent requests.
 */
const tenantStorage = new AsyncLocalStorage<string>();

/**
 * Run a block of work scoped to a tenant_id. All Prisma reads/writes
 * inside `fn` are automatically filtered/injected with this tenant_id.
 *
 * Used by:
 *  - S03 auth middleware (sets tenant from session)
 *  - S02 seed + isolation tests (sets tenant explicitly)
 */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(tenantId, fn);
}

/**
 * Synchronous variant — for use inside the Prisma extension query callback
 * where we are already inside a `runWithTenant` scope.
 */
export function getTenantId(): string | null {
  return tenantStorage.getStore() ?? null;
}

/**
 * Returns the tenant_id for the current request, throwing if absent.
 * Use inside protected API routes where a tenant is guaranteed.
 */
export async function requireTenantId(): Promise<string> {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error(
      "Tenant context required but no tenant resolved. Wrap the request in runWithTenant()."
    );
  }
  return tenantId;
}
