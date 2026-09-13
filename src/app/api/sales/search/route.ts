/**
 * GET /api/sales/search — unified product + serial search for the sales cart (doc §4.3, §5.2).
 *
 * Searches by: product name, model, SKU, OR serial number.
 * Returns grouped results: each product card shows available IN_STOCK serials.
 * Out-of-stock products are included but flagged (so UI can disable them).
 *
 * Response shape:
 *   [
 *     {
 *       productId, name, model, sku, defaultPrice,
 *       onHand, outOfStock: boolean,
 *       serials: [{ id, serialNo }]  // IN_STOCK serials for this product
 *     }
 *   ]
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

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
      serialNo: { contains: q },
    },
    include: {
      product: {
        select: { id: true, name: true, model: true, sku: true, defaultPrice: true },
      },
    },
    take: 100,
  });

  // Find products matching name/model/sku search.
  const matchingProducts = await db.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q } },
        { model: { contains: q } },
        { sku: { contains: q } },
      ],
    },
    select: { id: true, name: true, model: true, sku: true, defaultPrice: true },
  });

  // Merge: collect all product IDs from both sources.
  const productMap = new Map<string, {
    productId: string;
    name: string;
    model: string | null;
    sku: string;
    defaultPrice: number | null;
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
        serials: [],
      });
    }
    productMap.get(p.id)!.serials.push({ id: unit.id, serialNo: unit.serialNo });
  }

  // Add products from name/model/sku matches (fetch their serials separately).
  const productIdsNeedingSerials = matchingProducts
    .filter((p) => !productMap.has(p.id))
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

    for (const p of matchingProducts.filter((p) => !productMap.has(p.id))) {
      productMap.set(p.id, {
        productId: p.id,
        name: p.name,
        model: p.model,
        sku: p.sku,
        defaultPrice: p.defaultPrice,
        serials: serialsByProduct.get(p.id) ?? [],
      });
    }
  }

  // Build final results: sort by name, flag out-of-stock.
  const results = Array.from(productMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      ...p,
      onHand: p.serials.length,
      outOfStock: p.serials.length === 0,
    }));

  return NextResponse.json({ results });
});
