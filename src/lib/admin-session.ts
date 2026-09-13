/**
 * Admin session helpers — guard for super-admin API routes (doc §3.3.1).
 *
 * Uses the SAME NextAuth instance as tenant users (auth.ts) — a single
 * shared session. The role field distinguishes SUPER_ADMIN sessions.
 * Mirror of session.ts but checks role === SUPER_ADMIN and skips tenant scope.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type AdminSessionUser = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN";
};

/**
 * Wrap an admin API handler: requires a super-admin session.
 * No tenant context (admin is cross-tenant by design). Passes req + ctx
 * so dynamic route params ([id]) are accessible.
 */
export function withAdmin(
  handler: (admin: AdminSessionUser, req: Request, ctx?: any) => Promise<Response | NextResponse>
): (req: Request, ctx?: any) => Promise<Response | NextResponse> {
  return async (req: Request, ctx?: any) => {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin unauthorized" }, { status: 401 });
    }
    const u = session.user;
    return handler({
      id: u.id,
      email: u.email,
      name: u.name ?? u.email,
      role: "SUPER_ADMIN",
    }, req, ctx);
  };
}
