/**
 * GET /api/reports/rma-status — RMA status report (doc §5.3).
 * Placeholder: RMA module lands in S21. Returns empty until then.
 * API structure is ready — S21 will populate it automatically.
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, summary }
 *
 * Summary (totals) is computed across ALL matching tickets (not just the page)
 * so the summary stays accurate regardless of which page the user is viewing.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with search.
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { rmaNo: { contains: q } },
            { faultReason: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  // Fetch ALL matching tickets for summary totals (lightweight select).
  const allTickets = await db.rmaTicket.findMany({
    where,
    select: { id: true, stage: true, eta: true },
  });

  const total = allTickets.length;
  const byStage: Record<string, number> = {};
  let overdueCount = 0;
  const now = new Date();

  for (const t of allTickets) {
    byStage[t.stage] = (byStage[t.stage] ?? 0) + 1;
    if (t.eta && t.eta < now && t.stage !== "DELIVERED_TO_CUSTOMER") {
      overdueCount++;
    }
  }

  // Fetch the PAGE's tickets with full includes.
  const tickets = await db.rmaTicket.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      product: { select: { name: true, model: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { dateOpened: "desc" },
    skip,
    take,
  });

  const rows = tickets.map((t) => ({
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
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    summary: {
      total,
      byStage,
      overdueCount,
    },
  });
});
