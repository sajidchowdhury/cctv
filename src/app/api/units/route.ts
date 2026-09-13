/**
 * GET  /api/units — list units (tenant-scoped).
 * POST /api/units — create a unit (owner-addable, doc §4.1).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({ name: z.string().min(1).max(30) });

export const GET = withTenant(async (user) => {
  const units = await db.unit.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ units });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unit name required." }, { status: 422 });
  }
  try {
    const unit = await db.unit.create({ data: { name: parsed.data.name }, select: { id: true, name: true } });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Unit name already exists." }, { status: 409 });
    }
    throw err;
  }
});
