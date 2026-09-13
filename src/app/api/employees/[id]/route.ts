/**
 * GET    /api/employees/[id] — fetch employee with salary records.
 * PATCH  /api/employees/[id] — update employee.
 * DELETE /api/employees/[id] — soft-delete.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      salaryRecords: { orderBy: { month: "desc" }, take: 12 },
    },
  });
  if (!employee || employee.deletedAt) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  return NextResponse.json({ employee });
});

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(["STAFF", "SALESMAN", "ACCOUNTANT", "INSTALLER"]).optional(),
  salary: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "RESIGNED"]).optional(),
});

export const PATCH = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
  const employee = await db.employee.update({
    where: { id }, data: parsed.data,
    select: { id: true, name: true, salary: true },
  });
  return NextResponse.json({ employee });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
