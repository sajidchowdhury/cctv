/**
 * GET /api/billing/settings — read the current tenant's payment settings (F6-S1).
 *
 * Used by the /payment page to display the configured bKash/Nagad/Bank numbers
 * + the monthly fee. Tenant-scoped via withTenantAny (allows PENDING/LOCKED users).
 */
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { withTenantAny } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenantAny(async (user, _req: Request) => {
  const tenant = await adminDb.tenant.findUnique({
    where: { id: user.tenantId! },
    select: {
      bkashNumber: true, nagadNumber: true, bankDetails: true, monthlyFee: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({
    settings: {
      bkashNumber: tenant.bkashNumber,
      nagadNumber: tenant.nagadNumber,
      bankDetails: tenant.bankDetails,
      monthlyFee: tenant.monthlyFee,
      monthlyFeeDisplay: formatBDT(tenant.monthlyFee),
    },
  });
});
