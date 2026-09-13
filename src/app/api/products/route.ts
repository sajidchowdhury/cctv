/**
 * GET /api/products — list products (tenant-scoped) with optional filters.
 * POST /api/products — create a product (SKU auto-generated if not provided).
 *
 * Doc §4.1: product master with categories, units, SKU/barcode, low-stock threshold.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { generateSku } from "@/lib/sku";

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  categoryId: z.string().optional().nullable(),
  model: z.string().max(60).optional().nullable(),
  unitId: z.string().optional().nullable(),
  safetyStock: z.number().int().min(0).default(0),
  defaultPrice: z.number().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sku: z.string().max(40).optional(), // optional override; auto-generated if absent
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const lowStockOnly = url.searchParams.get("lowStock") === "1";

  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      ...(search ? { name: { contains: search } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true } },
      inventoryUnits: {
        where: { status: "IN_STOCK" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute on-hand qty + low-stock flag.
  let rows = products.map((p) => {
    const onHand = p.inventoryUnits.length;
    return {
      id: p.id,
      name: p.name,
      model: p.model,
      sku: p.sku,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      unitId: p.unitId,
      unitName: p.unit?.name ?? null,
      safetyStock: p.safetyStock,
      defaultPrice: p.defaultPrice,
      imageUrl: p.imageUrl,
      onHand,
      lowStock: onHand <= p.safetyStock,
      createdAt: p.createdAt,
    };
  });

  if (lowStockOnly) {
    rows = rows.filter((r) => r.lowStock);
  }

  return NextResponse.json({ products: rows });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { name, categoryId, model, unitId, safetyStock, defaultPrice, imageUrl, sku } = parsed.data;

  // Resolve category name for SKU prefix.
  let categoryName: string | null = null;
  if (categoryId) {
    const cat = await db.category.findUnique({ where: { id: categoryId } });
    categoryName = cat?.name ?? null;
  }

  // Auto-generate SKU if not provided.
  const finalSku = sku?.trim() || (await generateSku(user.tenantId!, categoryName, model ?? null));

  try {
    const product = await db.product.create({
      data: {
        tenantId: user.tenantId!,
        name,
        categoryId: categoryId || null,
        model: model || null,
        unitId: unitId || null,
        safetyStock,
        defaultPrice: defaultPrice ?? null,
        imageUrl: imageUrl || null,
        sku: finalSku,
      },
      include: {
        category: { select: { name: true } },
        unit: { select: { name: true } },
      },
    });
    return NextResponse.json(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryName: product.category?.name ?? null,
        unitName: product.unit?.name ?? null,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "SKU already exists for this tenant. Try again or set a unique SKU." },
        { status: 409 }
      );
    }
    console.error("[products/create] error:", err);
    return NextResponse.json({ error: "Failed to create product." }, { status: 500 });
  }
});
