/**
 * GET /api/products — list products (tenant-scoped) with optional filters.
 * POST /api/products — create a product (SKU auto-generated if not provided).
 *
 * Doc §4.1: product master with categories, units, SKU/barcode, low-stock threshold.
 *
 * F1-S2: each product has `isSerialised` flag.
 *   - Serialised (true): onHand = count of IN_STOCK InventoryUnit rows (cameras/DVRs).
 *   - Non-serialised (false): onHand = ΣPurchaseItem.qty − ΣSaleItem.qty (cables/PSU).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { generateSku } from "@/lib/sku";
import { computeOnHandBatch } from "@/lib/onhand";

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  categoryId: z.string().optional().nullable(),
  model: z.string().max(60).optional().nullable(),
  unitId: z.string().optional().nullable(),
  safetyStock: z.number().int().min(0).default(0),
  defaultPrice: z.number().min(0).optional().nullable(),
  isSerialised: z.boolean().default(true), // F1-S2
  imageUrl: z.string().regex(/^(https?:\/\/|\/).+/, "Must be a URL or root-relative path").optional().nullable(),
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
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    select: {
      id: true,
      name: true,
      model: true,
      sku: true,
      categoryId: true,
      unitId: true,
      safetyStock: true,
      defaultPrice: true,
      isSerialised: true,
      imageUrl: true,
      createdAt: true,
      category: { select: { name: true } },
      unit: { select: { name: true } },
      // Phase 3 / Feature #9: include the most recent PurchaseItem for this
      // product so the purchase cart can show "Last purchase: BDT X,XXX on
      // DD-MM-YYYY" below the unit price input. Filters out soft-deleted
      // purchases so a deleted purchase doesn't surface as the "last" rate.
      purchaseItems: {
        where: { purchase: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { unitPrice: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute onHand via shared helper (handles both serialised + non-serialised).
  const onHandMap = await computeOnHandBatch(
    db,
    user.tenantId!,
    products.map((p) => ({ id: p.id, isSerialised: p.isSerialised }))
  );

  let rows = products.map((p) => {
    const onHand = onHandMap.get(p.id) ?? 0;
    // Last purchase rate: per-unit price from the most recent PurchaseItem.
    // null if the product has never been purchased.
    const lastPurchase = p.purchaseItems[0] ?? null;
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
      isSerialised: p.isSerialised,
      imageUrl: p.imageUrl,
      onHand,
      lowStock: onHand <= p.safetyStock,
      createdAt: p.createdAt,
      // Phase 3 / Feature #9: last purchase rate + date for the purchase cart hint.
      lastPurchaseRate: lastPurchase?.unitPrice ?? null,
      lastPurchaseDate: lastPurchase?.createdAt ?? null,
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
  const { name, categoryId, model, unitId, safetyStock, defaultPrice, isSerialised, imageUrl, sku } = parsed.data;

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
        isSerialised,
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
        isSerialised: product.isSerialised,
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
