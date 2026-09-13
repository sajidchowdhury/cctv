/**
 * Session helpers — wire NextAuth sessions into the tenant context + role guard.
 *
 * Every tenant-scoped API route should be wrapped in `withTenant` (sets the
 * AsyncLocalStorage tenant_id so the Prisma extension auto-filters) and, where
 * role-restricted, `withRole` (rejects unauthorized roles with 403).
 *
 * Locked / pending tenants are blocked from module routes and pointed to /payment.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type Role, type SubscriptionStatus } from "@/lib/auth";
import { runWithTenant } from "@/lib/tenant-context";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  tenantId: string;
  subscriptionStatus: SubscriptionStatus;
};

/** Statuses that block module access (doc §3.3). */
const BLOCKED: SubscriptionStatus[] = ["LOCKED", "PENDING_ACTIVATION"];

/**
 * Wrap an API handler with: auth check → tenant context → locked-tenant gate.
 *
 * The handler receives the authenticated session user and runs inside a
 * `runWithTenant` scope, so Prisma reads/writes are auto-scoped.
 */
export function withTenant(
  handler: (user: SessionUser) => Promise<Response | NextResponse>
): (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return async (_req: Request, _ctx?: any) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;

    if (BLOCKED.includes(user.subscriptionStatus)) {
      return NextResponse.json(
        {
          error: "Subscription not active.",
          redirect: "/payment",
          subscriptionStatus: user.subscriptionStatus,
        },
        { status: 402 }
      );
    }

    return runWithTenant(user.tenantId, () => handler(user));
  };
}

/**
 * Wrap an API handler that requires one of the given roles.
 * Combines `withTenant` + a role check.
 *
 * Example: a Salesman calling an accounting endpoint → 403.
 */
export function withRole(
  roles: Role[]
): (
  handler: (user: SessionUser) => Promise<Response | NextResponse>
) => (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return (handler) =>
    withTenant(async (user) => {
      if (!roles.includes(user.role)) {
        return NextResponse.json(
          { error: "Forbidden: insufficient role.", required: roles },
          { status: 403 }
        );
      }
      return handler(user);
    });
}

/** Convenience: get the current session user (or null). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) ?? null;
}
