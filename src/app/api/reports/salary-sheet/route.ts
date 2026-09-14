/**
 * GET /api/reports/salary-sheet — monthly payroll summary (doc §5.3).
 * Aggregates by month with totals.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { formatBDT } from "@/lib/format";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? "";

  const records = await db.salaryRecord.findMany({
    where: {
      tenantId: user.tenantId!,
      ...(month ? { month } : {}),
    },
    include: { employee: { select: { name: true, role: true } } },
    orderBy: [{ month: "desc" }, { employee: { name: "asc" } }],
  });

  const totalBasic = records.reduce((s, r) => s + r.basic, 0);
  const totalAllowance = records.reduce((s, r) => s + r.allowance, 0);
  const totalDeduction = records.reduce((s, r) => s + r.advanceDeduction, 0);
  const totalNet = records.reduce((s, r) => s + r.netPayable, 0);
  const paidCount = records.filter((r) => r.paidOn).length;

  return NextResponse.json({
    month: month || "all",
    summary: {
      count: records.length,
      paidCount,
      pendingCount: records.length - paidCount,
      totalBasic, totalAllowance, totalDeduction, totalNet,
      totalBasicDisplay: formatBDT(totalBasic),
      totalAllowanceDisplay: formatBDT(totalAllowance),
      totalDeductionDisplay: formatBDT(totalDeduction),
      totalNetDisplay: formatBDT(totalNet),
    },
    records: records.map((r) => ({
      id: r.id, month: r.month,
      employeeName: r.employee.name, employeeRole: r.employee.role,
      basic: r.basic, allowance: r.allowance, advanceDeduction: r.advanceDeduction,
      netPayable: r.netPayable, paidOn: r.paidOn?.toISOString() ?? null,
    })),
  });
});
