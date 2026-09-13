/**
 * On-hand stock computation helper — F1-S2.
 *
 * Two stock-tracking modes per Product:
 *   - isSerialised = true  → onHand = count of IN_STOCK InventoryUnit rows
 *                            (one unit per serial; cameras/DVRs/NVRs)
 *   - isSerialised = false → onHand = ΣPurchaseItem.qty − ΣSaleItem.qty
 *                            (qty-based; cables/PSU/accessories — fractional allowed)
 *
 * This helper centralises the formula so all 5 places that compute onHand
 * (products list, product detail, low-stock, sales search, stock-summary report)
 * stay in sync.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Compute onHand for a single product.
 * Returns 0 for serialised products with no InventoryUnits.
 */
export async function computeOnHand(
  tx: Tx,
  tenantId: string,
  productId: string,
  isSerialised: boolean
): Promise<number> {
  if (isSerialised) {
    // Count of IN_STOCK inventory units.
    return await tx.inventoryUnit.count({
      where: { tenantId, productId, status: "IN_STOCK", deletedAt: null },
    });
  }
  // Non-serialised: sum of PurchaseItem.qty − sum of SaleItem.qty.
  // Soft-deleted purchases/sales are excluded via the Prisma extension (db client) —
  // when using adminDb, callers must add deletedAt: null filters manually.
  const [purchased, sold] = await Promise.all([
    tx.purchaseItem.aggregate({
      where: {
        tenantId,
        productId,
        purchase: { deletedAt: null },
      },
      _sum: { qty: true },
    }),
    tx.saleItem.aggregate({
      where: {
        tenantId,
        productId,
        sale: { deletedAt: null },
      },
      _sum: { qty: true },
    }),
  ]);
  const purchasedQty = purchased._sum.qty ?? 0;
  const soldQty = sold._sum.qty ?? 0;
  return Math.max(0, purchasedQty - soldQty);
}

/**
 * Compute onHand for many products in one round-trip.
 * Returns a Map<productId, number>.
 *
 * For serialised products: groups IN_STOCK InventoryUnit rows by productId.
 * For non-serialised products: aggregates PurchaseItem.qty − SaleItem.qty.
 */
export async function computeOnHandBatch(
  tx: Tx,
  tenantId: string,
  products: { id: string; isSerialised: boolean }[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (products.length === 0) return result;

  const serialisedIds = products.filter((p) => p.isSerialised).map((p) => p.id);
  const nonSerialisedIds = products.filter((p) => !p.isSerialised).map((p) => p.id);

  // Serialised: count IN_STOCK units per productId.
  if (serialisedIds.length > 0) {
    const unitCounts = await tx.inventoryUnit.groupBy({
      by: ["productId"],
      where: {
        tenantId,
        productId: { in: serialisedIds },
        status: "IN_STOCK",
        deletedAt: null,
      },
      _count: { id: true },
    });
    for (const row of unitCounts) {
      result.set(row.productId, row._count.id);
    }
    // Serialised products with no IN_STOCK units: default to 0.
    for (const id of serialisedIds) {
      if (!result.has(id)) result.set(id, 0);
    }
  }

  // Non-serialised: aggregate PurchaseItem.qty − SaleItem.qty.
  if (nonSerialisedIds.length > 0) {
    const [purchasedAgg, soldAgg] = await Promise.all([
      tx.purchaseItem.groupBy({
        by: ["productId"],
        where: {
          tenantId,
          productId: { in: nonSerialisedIds },
          purchase: { deletedAt: null },
        },
        _sum: { qty: true },
      }),
      tx.saleItem.groupBy({
        by: ["productId"],
        where: {
          tenantId,
          productId: { in: nonSerialisedIds },
          sale: { deletedAt: null },
        },
        _sum: { qty: true },
      }),
    ]);
    const purchasedMap = new Map<string, number>();
    for (const row of purchasedAgg) {
      purchasedMap.set(row.productId, row._sum.qty ?? 0);
    }
    const soldMap = new Map<string, number>();
    for (const row of soldAgg) {
      soldMap.set(row.productId, row._sum.qty ?? 0);
    }
    for (const id of nonSerialisedIds) {
      const purchased = purchasedMap.get(id) ?? 0;
      const sold = soldMap.get(id) ?? 0;
      result.set(id, Math.max(0, purchased - sold));
    }
  }

  return result;
}

/**
 * Auto-suggest isSerialised based on category name (F1-S2 doc).
 *   - Camera, DVR, NVR → true (serialised, tracked per-unit)
 *   - Cable, PSU, Accessories, Service → false (qty-based)
 *   - unknown / null → true (default — safer to track per-unit)
 */
export function suggestIsSerialised(categoryName: string | null | undefined): boolean {
  if (!categoryName) return true;
  const name = categoryName.toLowerCase();
  if (name.includes("cable") || name.includes("psu") || name.includes("power") || name.includes("adapter")) {
    return false;
  }
  if (name.includes("accessor") || name.includes("service") || name.includes("misc")) {
    return false;
  }
  // Default: cameras/DVRs/NVRs/recorders/etc. → serialised.
  return true;
}
