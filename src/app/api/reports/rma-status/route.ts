/**
 * GET /api/reports/rma-status — RMA status report (doc §5.3).
 * Placeholder: RMA module lands in S21. Returns empty until then.
 * API structure is ready — S21 will populate it automatically.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user) => {
  // RMA tickets schema exists (S02). Query is ready even though the
  // RMA UI (S21) hasn't been built yet.
  const tickets = await db.rmaTicket.findMany({
    where: { deletedAt: null },
    include: {
      customer: { select: { name: true } },
      product: { select: { name: true, model: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { dateOpened: "desc" },
    take: 100,
  });

  const byStage: Record<string, number> = {};
  let overdueCount = 0;
  const now = new Date();

  for (const t of tickets) {
    byStage[t.stage] = (byStage[t.stage] ?? 0) + 1;
    if (t.eta && t.eta < now && t.stage !== "DELIVERED_TO_CUSTOMER") {
      overdueCount++;
    }
  }

  return NextResponse.json({
    summary: {
      total: tickets.length,
      byStage,
      overdueCount,
    },
    tickets: tickets.map((t) => ({
      id: t.id,
      rmaNo: t.rmaNo,
      dateOpened: t.dateOpened.toISOString(),
      customerName: t.customer?.name ?? "—",
      productName: t.product?.name ?? "—",
      productModel: t.product?.model ?? "—",
      supplierName: t.supplier?.name ?? "—",
      faultReason: t.faultReason,
      stage: t.stage,
      vendorRmaRef: t.vendorRmaRef,
      vendorCharge: t.vendorCharge,
      eta: t.eta?.toISOString() ?? null,
      closedAt: t.closedAt?.toISOString() ?? null,
      overdue: t.eta && t.eta < now && t.stage !== "DELIVERED_TO_CUSTOMER",
    })),
  });
});
