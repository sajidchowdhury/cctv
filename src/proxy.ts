/**
 * Middleware — locked-tenant gate + auth redirect (doc §3.3).
 *
 * Page-level protection. API routes enforce auth via withTenant/withRole/withAdmin.
 *
 * Logic:
 *   - Public paths (login, signup, verify-email, change-email, payment,
 *     admin/*, api/*, static assets) → pass through. Admin pages self-gate
 *     on session.user.role === "SUPER_ADMIN".
 *   - No token → redirect to /login (NextAuth withAuth default).
 *   - SUPER_ADMIN tokens → allowed everywhere (admin control plane).
 *   - Token with LOCKED or PENDING_ACTIVATION status → redirect to /payment
 *     (unless already there).
 *   - Otherwise → allow.
 *
 * CRITICAL: All responses include Cache-Control: no-store so the browser
 * NEVER caches authenticated pages. Without this, after logout the browser
 * can serve a cached dashboard page directly (bypassing the middleware),
 * making it appear like the user is still logged in.
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  (req) => {
    const role = req.nextauth.token?.role as string | undefined;
    const status = req.nextauth.token?.subscriptionStatus as
      | "ACTIVE"
      | "GRACE"
      | "LOCKED"
      | "PENDING_ACTIVATION"
      | undefined;

    const path = req.nextUrl.pathname;

    // Super-admins go wherever they want (admin control plane).
    if (role === "SUPER_ADMIN") {
      const res = NextResponse.next();
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res;
    }

    // Locked / pending activation → must visit /payment (only reachable screen).
    if (
      (status === "LOCKED" || status === "PENDING_ACTIVATION") &&
      path !== "/cctv/payment"
    ) {
      const res = NextResponse.redirect(new URL("/cctv/payment", req.url));
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res;
    }

    // Authorized: allow the request through, but NEVER cache the page.
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  },
  {
    callbacks: {
      // A token means "authenticated" → authorised to proceed past the gate.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/cctv/login",
    },
  }
);

export const config = {
  // Match page routes only. API routes handle auth via withTenant/withRole/withAdmin.
  // Excluded: api, auth pages, admin (self-gates on role), static assets, uploads.
  matcher: [
    "/((?!api|login|signup|verify-email|change-email|payment|admin|manifest.json|sw.js|_next/static|_next/image|favicon.ico|logo.svg|robots.txt|uploads).*)",
  ],
};
