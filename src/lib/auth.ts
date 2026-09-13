/**
 * NextAuth.js v4 configuration — Session S03.
 *
 * Doc §3.3: 1-email-per-account, no free trial, manual payment verification.
 *
 * Session shape carries: tenantId, role, subscriptionStatus — used by the
 * middleware (locked-tenant gate) and the withTenant/withRole API guards.
 *
 * JWT refresh: the subscription status is re-read from the DB on each token
 * access if older than 60s, so an admin verify/lock takes effect quickly
 * without a re-login. (Bounded DB hit: 1 query / min / user.)
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/db";

/** Role enum (doc §3, §4). */
export type Role = "OWNER" | "MANAGER" | "SALESMAN" | "ACCOUNTANT";

/** Subscription lifecycle status (doc §3.3). */
export type SubscriptionStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "GRACE"
  | "LOCKED";

/** Augment NextAuth types with tenant + role fields. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      tenantId: string;
      subscriptionStatus: SubscriptionStatus;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantId?: string;
    role?: Role;
    subscriptionStatus?: SubscriptionStatus;
    refreshedAt?: number;
  }
}

/** Max age (ms) before the JWT's subscription status is re-read from DB. */
const REFRESH_INTERVAL_MS = 60_000;

export const authOptions: NextAuthOptions = {
  // Credentials provider: email + password (doc §3.3).
  // Email verification happens in a separate step before first login.
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // adminDb: user lookup is cross-tenant-neutral (email is global unique).
        const user = await adminDb.user.findUnique({
          where: { email },
          include: {
            tenant: {
              include: { subscription: true },
            },
          },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        const sub = user.tenant.subscription;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          tenantId: user.tenantId,
          subscriptionStatus: (sub?.status ?? "PENDING_ACTIVATION") as SubscriptionStatus,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /** On sign-in, stash tenant + role on the token. Refresh status periodically. */
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.userId = u.id;
        token.tenantId = u.tenantId;
        token.role = u.role;
        token.subscriptionStatus = u.subscriptionStatus;
        token.refreshedAt = Date.now();
        return token;
      }
      // Periodic refresh of subscription status from DB (doc §3.3 lifecycle).
      const stale =
        !token.refreshedAt ||
        Date.now() - token.refreshedAt > REFRESH_INTERVAL_MS;
      if (stale && token.tenantId) {
        try {
          const sub = await adminDb.subscription.findUnique({
            where: { tenantId: token.tenantId },
          });
          if (sub) {
            token.subscriptionStatus = sub.status as SubscriptionStatus;
          }
          token.refreshedAt = Date.now();
        } catch {
          // DB errors don't invalidate the session; keep last known status.
        }
      }
      return token;
    },

    /** Expose tenant + role on the session object. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId!;
        session.user.tenantId = token.tenantId!;
        session.user.role = token.role!;
        session.user.subscriptionStatus = token.subscriptionStatus!;
      }
      return session;
    },
  },
};

export default authOptions;
