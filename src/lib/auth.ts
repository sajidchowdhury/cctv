/**
 * NextAuth.js v4 configuration — S01 stub.
 *
 * S03 builds the full credentials provider, RBAC (Owner/Manager/Salesman/Accountant),
 * email verification, and the locked-tenant gate.
 *
 * The shape below documents the contract; it is not wired into middleware yet.
 */
import type { NextAuthOptions } from "next-auth";

/**
 * Session shape augmented with tenant + role (doc §3).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "OWNER" | "MANAGER" | "SALESMAN" | "ACCOUNTANT";
      tenantId: string;
      subscriptionStatus: "ACTIVE" | "GRACE" | "LOCKED" | "PENDING_ACTIVATION";
    };
  }
}

/**
 * Auth options placeholder. S03 replaces with real providers + adapter.
 */
export const authOptions: NextAuthOptions = {
  // TODO(S03): CredentialsProvider + PrismaAdapter
  providers: [],
  // TODO(S03): callbacks.jwt + callbacks.session to inject tenantId, role, subscriptionStatus
  callbacks: {},
};

export default authOptions;
