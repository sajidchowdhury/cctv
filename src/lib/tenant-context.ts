/**
 * Tenant Context — resolves the active tenant_id for the current request.
 *
 * S01: stub implementation. S02 wires the Prisma tenant_id middleware;
 * S03 resolves the tenant from the authenticated NextAuth session.
 *
 * Architecture rule (doc §3.1): tenant_id is mandatory on every business
 * table. Every query must be scoped by it (replicates PostgreSQL RLS on SQLite).
 */

/**
 * Returns the tenant_id for the current request, or null if unauthenticated.
 *
 * S01 stub: always returns null — no auth yet.
 * S03: reads from `getServerSession()` → session.user.tenantId.
 */
export async function getTenantId(): Promise<string | null> {
  // TODO(S03): resolve from NextAuth session
  return null;
}

/**
 * Returns the tenant_id for the current request, throwing if absent.
 * Use inside protected API routes where a tenant is guaranteed.
 */
export async function requireTenantId(): Promise<string> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("Tenant context required but no tenant resolved.");
  }
  return tenantId;
}

/**
 * Role enum — enforced on every API route + page (doc §3, §4).
 * Shared with the auth layer in S03.
 */
export type Role = "OWNER" | "MANAGER" | "SALESMAN" | "ACCOUNTANT";
