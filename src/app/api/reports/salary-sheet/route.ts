/**
 * GET /api/reports/salary-sheet — monthly payroll summary (doc §5.3).
 * Aggregates by month with totals.
 *
 * Phase 3: server-side pagination + search. Accepts ?page=1&pageSize=50&q=search
 * Returns: { rows, total, page, pageSize, totalPages, month, summary }
 *
 * Summary (totals) is computed across ALL matching records (not just the page)
 * so the summary stays accurate regardless of which page the user is viewing.
 * Search: employee name.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";
import { parsePagination, paginateResponse } from "@/lib/pagination";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? "";
  const { page, pageSize, skip, take, q } = parsePagination(req);

  // Build where clause with month + search on employee name.
  const where: Prisma.SalaryRecordWhereInput = {
    tenantId: user.tenantId!,
    ...(month ? { month } : {}),
    ...(q ? { employee: { name: { contains: q, mode: "insensitive" } } } : {}),
  };

  // Fetch ALL matching records for summary totals (lightweight select).
  const allRecords = await db.salaryRecord.findMany({
    where,
    select: { id: true, basic: true, allowance: true, advanceDeduction: true, netPayable: true, paidOn: true },
  });

  const totalBasic = allRecords.reduce((s, r) => s + r.basic, 0);
  const totalAllowance = allRecords.reduce((s, r) => s + r.allowance, 0);
  const totalDeduction = allRecords.reduce((s, r) => s + r.advanceDeduction, 0);
  const totalNet = allRecords.reduce((s, r) => s + r.netPayable, 0);
  const paidCount = allRecords.filter((r) => r.paidOn).length;
  const total = allRecords.length;

  // Fetch the PAGE's records with full includes.
  const records = await db.salaryRecord.findMany({
    where,
    include: { employee: { select: { name: true, role: true } } },
    orderBy: [{ month: "desc" }, { employee: { name: "asc" } }],
    skip,
    take,
  });

  const rows = records.map((r) => ({
    id: r.id, month: r.month,
    employeeName: r.employee.name, employeeRole: r.employee.role,
    basic: r.basic, allowance: r.allowance, advanceDeduction: r.advanceDeduction,
    netPayable: r.netPayable, paidOn: r.paidOn?.toISOString() ?? null,
  }));

  return NextResponse.json({
    ...paginateResponse(rows, total, page, pageSize),
    month: month || "all",
    summary: {
      count: total,
      paidCount,
      pendingCount: total - paidCount,
      totalBasic, totalAllowance, totalDeduction, totalNet,
      totalBasicDisplay: formatBDT(totalBasic),
      totalAllowanceDisplay: formatBDT(totalAllowance),
      totalDeductionDisplay: formatBDT(totalDeduction),
      totalNetDisplay: formatBDT(totalNet),
    },
  });
});
