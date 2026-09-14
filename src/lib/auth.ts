/**
 * NextAuth.js v4 configuration — Session S03 + S05.
 *
 * Doc §3.3: 1-email-per-account, no free trial, manual payment verification.
 *
 * Two credential providers share one NextAuth instance:
 *   1. "credentials" — tenant users (OWNER/MANAGER/SALESMAN/ACCOUNTANT)
 *   2. "admin-credentials" — super-admins (platform operator, doc §3.3.1)
 *
 * Sharing one instance avoids dual-CSRF-cookie routing issues; the role
 * field on the JWT distinguishes tenant vs admin sessions. The proxy + UI
 * gate admin pages on role === "SUPER_ADMIN".
 *
 * Session shape carries: tenantId (null for admin), role, subscriptionStatus.
 * JWT refresh: subscription status re-read from DB every 60s so admin
 * verify/lock takes effect without re-login (doc §3.3 "within 60 seconds").
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/db";
import { appPath } from "@/lib/app-path";

/** Role enum — tenant roles + platform super-admin (doc §3, §3.3.1). */
export type Role = "OWNER" | "MANAGER" | "SALESMAN" | "ACCOUNTANT" | "SUPER_ADMIN";

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
      tenantId: string | null; // null for SUPER_ADMIN
      subscriptionStatus: SubscriptionStatus | null; // null for SUPER_ADMIN
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantId?: string | null;
    role?: Role;
    subscriptionStatus?: SubscriptionStatus | null;
    refreshedAt?: number;
  }
}

/** Max age (ms) before the JWT's subscription status is re-read from DB. */
const REFRESH_INTERVAL_MS = 60_000;

export const authOptions: NextAuthOptions = {
  providers: [
    // ── 1. Tenant user credentials ───────────────────────────────
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        const user = await adminDb.user.findUnique({
          where: { email },
          include: { tenant: { include: { subscription: true } } },
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

    // ── 2. Super-admin credentials (doc §3.3.1) ──────────────────
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        const admin = await adminDb.superAdmin.findUnique({ where: { email } });
        if (!admin || !admin.passwordHash) return null;
        if (admin.status !== "ACTIVE") return null;

        const ok = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!ok) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: "SUPER_ADMIN" as Role,
          tenantId: null,
          subscriptionStatus: null,
        } as any;
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days

  pages: {
    // NextAuth does NOT auto-prepend Next.js basePath. Must use appPath()
    // so redirects go to /cctv/login (not /login → 404).
    signIn: appPath("/login"),
    error: appPath("/login"),
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
      // Periodic refresh of subscription status from DB (tenant users only).
      const stale =
        !token.refreshedAt ||
        Date.now() - token.refreshedAt > REFRESH_INTERVAL_MS;
      if (stale && token.tenantId && token.role !== "SUPER_ADMIN") {
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
        session.user.tenantId = token.tenantId ?? null;
        session.user.role = token.role!;
        session.user.subscriptionStatus = token.subscriptionStatus ?? null;
      }
      return session;
    },
  },
};

export default authOptions;
