/**
 * GET  /api/categories — list categories (tenant-scoped).
 * POST /api/categories — create a category (owner-addable, doc §4.1).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({ name: z.string().min(2).max(50) });

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const cats = await db.category.findMany({
    where: {
      deletedAt: null,
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({
    categories: cats.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products })),
  });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Category name (2–50 chars) required." }, { status: 422 });
  }
  try {
    const cat = await db.category.create({ data: { tenantId: user.tenantId!, name: parsed.data.name }, select: { id: true, name: true } });
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
    }
    throw err;
  }
});
