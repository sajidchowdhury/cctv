/**
 * GET  /api/account-heads — list account heads (tenant-scoped, customizable).
 * POST /api/account-heads — create (doc §4.4: owner can add 'Internet Bill', 'Generator Fuel', etc.).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  name: z.string().min(2).max(50),
  kind: z.enum(["IN", "EXP"]),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  const heads = await db.accountHead.findMany({
    where: { deletedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
  return NextResponse.json({
    accountHeads: heads.map((h) => ({ id: h.id, name: h.name, kind: h.kind, txnCount: h._count.transactions })),
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
  try {
    const head = await db.accountHead.create({
      data: { ...parsed.data, tenantId: user.tenantId! },
      select: { id: true, name: true, kind: true },
    });
    return NextResponse.json({ accountHead: head }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Account head name already exists." }, { status: 409 });
    }
    throw err;
  }
});
