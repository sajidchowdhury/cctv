/**
 * GET    /api/products/[id] — fetch a single product with on-hand qty.
 * PATCH  /api/products/[id] — update product fields.
 * DELETE /api/products/[id] — soft-delete a product.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      inventoryUnits: { select: { id: true, status: true } },
    },
  });
  if (!product || product.deletedAt) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  const onHand = product.inventoryUnits.filter((u) => u.status === "IN_STOCK").length;
  return NextResponse.json({
    product: {
      ...product,
      inventoryUnits: undefined,
      onHand,
      lowStock: onHand <= product.safetyStock,
    },
  });
});

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  categoryId: z.string().optional().nullable(),
  model: z.string().max(60).optional().nullable(),
  unitId: z.string().optional().nullable(),
  safetyStock: z.number().int().min(0).optional(),
  defaultPrice: z.number().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export const PATCH = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const product = await db.product.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, sku: true },
  });
  return NextResponse.json({ product });
});

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  // Soft delete (doc §3.1 — deletedAt on all business tables).
  await db.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
