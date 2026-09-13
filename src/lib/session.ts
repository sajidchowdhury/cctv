/**
 * Session helpers — wire NextAuth sessions into the tenant context + role guard.
 *
 * withTenant     — auth + tenant scope (blocks PENDING/LOCKED). For module routes.
 * withTenantAny  — auth + tenant scope, but allows PENDING/LOCKED. For billing
 *                  routes that a locked/pending user must reach (submit-payment,
 *                  history) per doc §3.3.
 * withRole       — withTenant + role check.
 * withAdmin      — super-admin only, no tenant scope (doc §3.3.1).
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
  tenantId: string | null; // null for SUPER_ADMIN
  subscriptionStatus: SubscriptionStatus | null; // null for SUPER_ADMIN
};

/** Statuses that block module access (doc §3.3). */
const BLOCKED: SubscriptionStatus[] = ["LOCKED", "PENDING_ACTIVATION"];

/**
 * Auth + tenant scope, but ALLOWS PENDING/LOCKED users. Use for billing
 * routes the user must reach while locked (submit-payment, history) per doc §3.3.
 */
export function withTenantAny(
  handler: (user: SessionUser, req: Request, ctx?: any) => Promise<Response | NextResponse>
): (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return async (req: Request, ctx?: any) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;

    // Super-admins never touch tenant routes.
    if (user.role === "SUPER_ADMIN" || !user.tenantId) {
      return NextResponse.json({ error: "Admins cannot access tenant routes." }, { status: 403 });
    }

    return runWithTenant(user.tenantId, () => handler(user, req, ctx));
  };
}

/**
 * Wrap an API handler with: auth check → tenant context → locked-tenant gate.
 * Blocks PENDING/LOCKED users from module routes (redirects to /payment).
 */
export function withTenant(
  handler: (user: SessionUser, req: Request, ctx?: any) => Promise<Response | NextResponse>
): (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return withTenantAny(async (user, req, ctx) => {
    const status = user.subscriptionStatus;
    if (status && BLOCKED.includes(status)) {
      return NextResponse.json(
        {
          error: "Subscription not active.",
          redirect: "/payment",
          subscriptionStatus: status,
        },
        { status: 402 }
      );
    }
    return handler(user, req, ctx);
  });
}

/**
 * Wrap an API handler that requires one of the given roles.
 * Combines `withTenant` + a role check.
 */
export function withRole(
  roles: Role[]
): (
  handler: (user: SessionUser, req: Request, ctx?: any) => Promise<Response | NextResponse>
) => (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return (handler) =>
    withTenant(async (user, req, ctx) => {
      if (!roles.includes(user.role)) {
        return NextResponse.json(
          { error: "Forbidden: insufficient role.", required: roles },
          { status: 403 }
        );
      }
      return handler(user, req, ctx);
    });
}

/** Convenience: get the current session user (or null). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) ?? null;
}
