/**
 * GET /api/sales/search — unified product + serial search for the sales cart (doc §4.3, §5.2).
 *
 * Searches by: product name, model, SKU, OR serial number.
 * Returns grouped results: each product card shows available IN_STOCK serials.
 * Out-of-stock products are included but flagged (so UI can disable them).
 *
 * F1-S2: each product carries `isSerialised`. Non-serialised products (cables/PSU)
 * return `serials: []` but compute onHand from PurchaseItem.qty − SaleItem.qty.
 * `outOfStock` is based on that qty-based onHand for non-serialised products.
 *
 * Response shape:
 *   [
 *     {
 *       productId, name, model, sku, defaultPrice, isSerialised,
 *       purchasePrice: number | null,  // F2-S3 — last purchase cost for margin display (role-gated on UI)
 *       onHand, outOfStock: boolean,
 *       serials: [{ id, serialNo }]  // IN_STOCK serials (empty for non-serialised)
 *     }
 *   ]
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // Find IN_STOCK inventory units matching the serial search.
  const matchingUnits = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      status: "IN_STOCK",
      serialNo: { contains: q, mode: "insensitive" },
    },
    include: {
      product: {
        select: {
          id: true, name: true, model: true, sku: true, defaultPrice: true, isSerialised: true,
          purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, select: { unitPrice: true } },
        },
      },
    },
    take: 100,
  });

  // Find products matching name/model/sku search.
  const matchingProducts = await db.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, name: true, model: true, sku: true, defaultPrice: true, isSerialised: true,
      purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, select: { unitPrice: true } },
    },
  });

  // Merge: collect all product IDs from both sources.
  const productMap = new Map<string, {
    productId: string;
    name: string;
    model: string | null;
    sku: string;
    defaultPrice: number | null;
    purchasePrice: number | null;  // F2-S3
    isSerialised: boolean;
    serials: { id: string; serialNo: string }[];
  }>();

  // Add products from serial matches (with their serials).
  for (const unit of matchingUnits) {
    const p = unit.product;
    if (!productMap.has(p.id)) {
      productMap.set(p.id, {
        productId: p.id,
        name: p.name,
        model: p.model,
        sku: p.sku,
        defaultPrice: p.defaultPrice,
        purchasePrice: p.purchaseItems[0]?.unitPrice ?? null,  // F2-S3
        isSerialised: p.isSerialised,
        serials: [],
      });
    }
    productMap.get(p.id)!.serials.push({ id: unit.id, serialNo: unit.serialNo });
  }

  // Add products from name/model/sku matches (fetch their serials separately, serialised only).
  const productIdsNeedingSerials = matchingProducts
    .filter((p) => p.isSerialised && !productMap.has(p.id))
    .map((p) => p.id);

  if (productIdsNeedingSerials.length > 0) {
    const unitsForProducts = await db.inventoryUnit.findMany({
      where: {
        deletedAt: null,
        status: "IN_STOCK",
        productId: { in: productIdsNeedingSerials },
      },
      select: { id: true, serialNo: true, productId: true },
      orderBy: { serialNo: "asc" },
    });

    // Group serials by productId.
    const serialsByProduct = new Map<string, { id: string; serialNo: string }[]>();
    for (const u of unitsForProducts) {
      if (!serialsByProduct.has(u.productId)) {
        serialsByProduct.set(u.productId, []);
      }
      serialsByProduct.get(u.productId)!.push({ id: u.id, serialNo: u.serialNo });
    }

    for (const p of matchingProducts.filter((p) => p.isSerialised && !productMap.has(p.id))) {
      productMap.set(p.id, {
        productId: p.id,
        name: p.name,
        model: p.model,
        sku: p.sku,
        defaultPrice: p.defaultPrice,
        purchasePrice: p.purchaseItems[0]?.unitPrice ?? null,  // F2-S3
        isSerialised: p.isSerialised,
        serials: serialsByProduct.get(p.id) ?? [],
      });
    }
  }

  // Add non-serialised matches (no serials, but valid stock).
  for (const p of matchingProducts.filter((p) => !p.isSerialised && !productMap.has(p.id))) {
    productMap.set(p.id, {
      productId: p.id,
      name: p.name,
      model: p.model,
      sku: p.sku,
      defaultPrice: p.defaultPrice,
      purchasePrice: p.purchaseItems[0]?.unitPrice ?? null,  // F2-S3
      isSerialised: p.isSerialised,
      serials: [],
    });
  }

  // Compute onHand via shared helper (handles both modes).
  const onHandMap = await computeOnHandBatch(
    db,
    user.tenantId!,
    Array.from(productMap.values()).map((p) => ({ id: p.productId, isSerialised: p.isSerialised }))
  );

  // Build final results: sort by name, flag out-of-stock based on onHand.
  const results = Array.from(productMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const onHand = onHandMap.get(p.productId) ?? 0;
      return {
        ...p,
        onHand,
        outOfStock: onHand <= 0,
      };
    });

  return NextResponse.json({ results });
});
