/**
 * GET  /api/employees — list employees (tenant-scoped).
 * POST /api/employees — create an employee (doc §4.6).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(["STAFF", "SALESMAN", "ACCOUNTANT", "INSTALLER"]).default("STAFF"),
  salary: z.number().min(0).default(0),
  joinDate: z.string().optional(),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const employees = await db.employee.findMany({
    where: {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      salaryRecords: {
        orderBy: { month: "desc" },
        take: 1,
        select: { id: true, month: true, netPayable: true, paidOn: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    employees: employees.map((e) => ({
      id: e.id, name: e.name, phone: e.phone, role: e.role,
      salary: e.salary, joinDate: e.joinDate, status: e.status,
      lastSalary: e.salaryRecords[0] ?? null,
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
  const { name, phone, role, salary, joinDate } = parsed.data;
  const employee = await db.employee.create({
    data: {
      tenantId: user.tenantId!,
      name, phone: phone ?? null, role, salary,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
    },
    select: { id: true, name: true, role: true, salary: true },
  });
  return NextResponse.json({ employee }, { status: 201 });
});
