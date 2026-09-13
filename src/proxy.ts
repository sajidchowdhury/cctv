/**
 * Middleware — locked-tenant gate + auth redirect (doc §3.3).
 *
 * Page-level protection. API routes enforce auth via withTenant/withRole.
 *
 * Logic:
 *   - Public paths (login, signup, verify-email, change-email, payment,
 *     api/auth/*, api/health, static assets) → pass through.
 *   - No token → redirect to /login (NextAuth withAuth default).
 *   - Token with LOCKED or PENDING_ACTIVATION status → redirect to /payment
 *     (unless already there).
 *   - Otherwise → allow.
 *
 * The subscription status comes from the JWT (refreshed server-side every
 * 60s in the jwt callback, so an admin verify/lock takes effect within ~1 min
 * without a re-login — doc §3.3 "access restored within 60 seconds").
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  (req) => {
    const status = req.nextauth.token?.subscriptionStatus as
      | "ACTIVE"
      | "GRACE"
      | "LOCKED"
      | "PENDING_ACTIVATION"
      | undefined;

    const path = req.nextUrl.pathname;

    // Locked / pending activation → must visit /payment (only reachable screen).
    if (
      (status === "LOCKED" || status === "PENDING_ACTIVATION") &&
      path !== "/payment"
    ) {
      return NextResponse.redirect(new URL("/payment", req.url));
    }
    // An active/grace user sitting on /payment is allowed (they may be viewing
    // their renewal status); no forced redirect away.
  },
  {
    callbacks: {
      // A token means "authenticated" → authorised to proceed past the gate.
      // The main function above then handles the locked redirect.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Match page routes only. API routes handle auth via withTenant/withRole.
  // Excluded: auth pages, api/*, static assets, uploads.
  matcher: [
    "/((?!api|login|signup|verify-email|change-email|payment|_next/static|_next/image|favicon.ico|logo.svg|robots.txt|uploads).*)",
  ],
};
