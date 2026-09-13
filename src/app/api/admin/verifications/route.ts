/**
 * GET /api/admin/verifications (doc §3.3.1)
 *
 * Super-admin queue of PENDING payment verifications.
 * Returns tenant name, txn ID, amount, paid date, sender, age.
 *
 * Query params: status (default PENDING), date filter, tenant filter.
 */
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db";
import { withAdmin } from "@/lib/admin-session";

export const GET = withAdmin(async (admin, req: Request) => {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const tenantFilter = url.searchParams.get("tenant") ?? undefined;

  const rows = await adminDb.paymentVerification.findMany({
    where: {
      status: status === "ALL" ? undefined : status,
      ...(tenantFilter ? { tenantId: tenantFilter } : {}),
    },
    include: {
      tenant: {
        select: { id: true, name: true, ownerEmail: true, phone: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return NextResponse.json({
    queue: rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant.name,
      ownerEmail: r.tenant.ownerEmail,
      ownerPhone: r.tenant.phone,
      method: r.method,
      txnId: r.txnId,
      amount: r.amount,
      paidDate: r.paidDate,
      senderNumber: r.senderNumber,
      status: r.status,
      submittedAt: r.createdAt,
      ageMinutes: Math.floor((now.getTime() - r.createdAt.getTime()) / 60_000),
    })),
    checkedBy: admin.email,
  });
});
