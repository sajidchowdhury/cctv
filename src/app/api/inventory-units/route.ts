/**
 * GET /api/inventory-units — list inventory units with stock availability (doc §4.3).
 *
 * Query: productId (filter), status (default IN_STOCK), search (serialNo).
 * Used by the sales screen for live stock + serial lookup.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") ?? undefined;
  const status = url.searchParams.get("status") ?? "IN_STOCK";
  const search = url.searchParams.get("q") ?? "";

  const units = await db.inventoryUnit.findMany({
    where: {
      deletedAt: null,
      ...(productId ? { productId } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(search ? { serialNo: { contains: search } } : {}),
    },
    include: {
      product: { select: { id: true, name: true, model: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    inventoryUnits: units.map((u) => ({
      id: u.id,
      serialNo: u.serialNo,
      status: u.status,
      warrantyEnd: u.warrantyEnd,
      productId: u.productId,
      productName: u.product.name,
      productModel: u.product.model,
      productSku: u.product.sku,
    })),
    count: units.length,
  });
});
