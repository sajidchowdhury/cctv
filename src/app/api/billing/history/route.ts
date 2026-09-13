/**
 * GET /api/billing/history (doc §3.3)
 *
 * Returns the tenant's payment-submission history + current subscription
 * status. Used by the /payment screen.
 */
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { withTenantAny } from "@/lib/session";

export const GET = withTenantAny(async (user) => {
  const [history, subscription] = await Promise.all([
    adminDb.paymentVerification.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        method: true,
        txnId: true,
        amount: true,
        paidDate: true,
        senderNumber: true,
        status: true,
        rejectionReason: true,
        verifiedAt: true,
        createdAt: true,
      },
    }),
    adminDb.subscription.findUnique({
      where: { tenantId: user.tenantId },
      select: { status: true, cycleEnd: true, startedAt: true, plan: true },
    }),
  ]);

  return NextResponse.json({ history, subscription });
});
