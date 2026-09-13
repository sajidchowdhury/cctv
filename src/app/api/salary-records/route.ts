/**
 * GET  /api/salary-records — list salary records (optionally by month).
 * POST /api/salary-records — create a monthly salary record (doc §4.6).
 *
 * Calculates netPayable = basic + allowance − advanceDeduction.
 * Employee basic is the default; can be overridden per record.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  employeeId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  basic: z.number().min(0).optional(), // defaults to employee.salary
  allowance: z.number().min(0).default(0),
  advanceDeduction: z.number().min(0).default(0),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? "";
  const records = await db.salaryRecord.findMany({
    where: {
      tenantId: user.tenantId,
      ...(month ? { month } : {}),
    },
    include: { employee: { select: { id: true, name: true, role: true } } },
    orderBy: { month: "desc" },
  });
  return NextResponse.json({
    salaryRecords: records.map((r) => ({
      id: r.id, month: r.month, basic: r.basic, allowance: r.allowance,
      advanceDeduction: r.advanceDeduction, netPayable: r.netPayable,
      paidOn: r.paidOn, transactionId: r.transactionId,
      employeeId: r.employeeId, employeeName: r.employee.name, employeeRole: r.employee.role,
    })),
  });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { employeeId, month, basic, allowance, advanceDeduction } = parsed.data;
  const tenantId = user.tenantId!;

  // Resolve basic from employee if not provided.
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.deletedAt) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  const finalBasic = basic ?? employee.salary;
  const netPayable = finalBasic + allowance - advanceDeduction;

  try {
    const record = await db.salaryRecord.create({
      data: { tenantId, employeeId, month, basic: finalBasic, allowance, advanceDeduction, netPayable },
      select: { id: true, month: true, netPayable: true },
    });
    return NextResponse.json({ salaryRecord: record }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: `Salary already recorded for ${month}.` }, { status: 409 });
    }
    throw err;
  }
});
