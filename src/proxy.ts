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
 * The subscription status comes from the JWT (refreshed server-side every
 * 60s in the jwt callback, so an admin verify/lock takes effect within ~1 min
 * without a re-login — doc §3.3 "access restored within 60 seconds").
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
    if (role === "SUPER_ADMIN") return NextResponse.next();

    // Locked / pending activation → must visit /payment (only reachable screen).
if (
  (status === "LOCKED" || status === "PENDING_ACTIVATION") &&
  path !== "/cctv/payment"
) {
  return NextResponse.redirect(new URL("/cctv/payment", req.url));
}
  },
  {
    callbacks: {
      // A token means "authenticated" → authorised to proceed past the gate.
      authorized: ({ token }) => !!token,
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
