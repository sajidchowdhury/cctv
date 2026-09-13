/**
 * GET /api/test/accounting — role-guard demo endpoint (S03 acceptance).
 *
 * Requires ACCOUNTANT or OWNER role. A Salesman or Manager gets 403.
 * Real accounting endpoints land in P3 (S15–S16); this proves the guard.
 */
import { NextResponse } from "next/server";
import { withRole } from "@/lib/session";

export const GET = withRole(["ACCOUNTANT", "OWNER"])(async (user) => {
  return NextResponse.json({
    ok: true,
    message: "Accounting access granted.",
    user: { email: user.email, role: user.role },
  });
});
