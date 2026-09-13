/**
 * GET /api/public/fee — return the platform's configured monthly fee (F6-S1).
 *
 * Public (no auth) — used by the signup page to show the current fee before the
 * user has a tenant. Reads from the first tenant (platform default carrier).
 * Falls back to 500 if no tenant exists yet.
 */
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { formatBDT } from "@/lib/format";

export const GET = async () => {
  const tenant = await adminDb.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { monthlyFee: true },
  });

  const monthlyFee = tenant?.monthlyFee ?? 500;
  return NextResponse.json({
    monthlyFee,
    monthlyFeeDisplay: formatBDT(monthlyFee),
  });
};
