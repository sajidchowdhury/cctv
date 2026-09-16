/**
 * Middleware — landing page + auth gate + locked-tenant redirect.
 *
 * Page-level protection. API routes enforce auth via withTenant/withRole/withAdmin.
 *
 * Logic:
 *   - Root path "/" → PUBLIC (landing page). If user is logged in, redirect
 *     to /dashboard so they don't see the landing page again.
 *   - Public paths (login, signup, verify-email, change-email, payment,
 *     admin/*, api/*, static assets) → pass through.
 *   - No token → redirect to /login (NextAuth withAuth default).
 *   - SUPER_ADMIN tokens → allowed everywhere (admin control plane).
 *   - Token with LOCKED or PENDING_ACTIVATION status → redirect to /payment
 *     (unless already there).
 *   - Otherwise → allow.
 *
 * CRITICAL: All responses include Cache-Control: no-store so the browser
 * NEVER caches authenticated pages.
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

    // Root path "/" is the landing page — public. But if the user IS logged
    // in, redirect them to /dashboard so they skip the landing page.
    if (path === "/cctv" || path === "/cctv/" || path === "/") {
      // Logged-in user → go to dashboard
      const res = NextResponse.redirect(new URL("/cctv/dashboard", req.url));
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res;
    }

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
      // NOTE: the root path "/" is handled above before this callback matters
      // — but we need authorized to return true for the root path so the
      // middleware function runs at all (otherwise withAuth redirects to
      // signIn before our code executes). So we allow the root path even
      // without a token.
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Root path is always authorized (landing page is public)
        if (path === "/cctv" || path === "/cctv/" || path === "/") return true;
        // All other paths require a token
        return !!token;
      },
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
