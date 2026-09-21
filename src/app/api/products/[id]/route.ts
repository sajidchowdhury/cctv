/**
 * GET    /api/products/[id] — fetch a single product with on-hand qty.
 * PATCH  /api/products/[id] — update product fields.
 * DELETE /api/products/[id] — soft-delete a product.
 *
 * F1-S2: products have `isSerialised` flag — onHand computation branches on it.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHand } from "@/lib/onhand";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      categoryId: true,
      model: true,
      sku: true,
      unitId: true,
      safetyStock: true,
      defaultPrice: true,
      isSerialised: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      category: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
    },
  });
  if (!product || product.deletedAt) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  const onHand = await computeOnHand(db, user.tenantId!, product.id, product.isSerialised);
  return NextResponse.json({
    product: {
      ...product,
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
  isSerialised: z.boolean().optional(), // F1-S2
  imageUrl: z.string().regex(/^(https?:\/\/|\/).+/, "Must be a URL or root-relative path").optional().nullable(),
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
    select: { id: true, name: true, sku: true, isSerialised: true },
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
