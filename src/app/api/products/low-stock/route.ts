/**
 * GET /api/products/low-stock — products at or below safety stock (doc §4.1).
 * Fires the low-stock alert event via INotifier (doc §4.1 "push + SMS to owner").
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { getNotifier } from "@/lib/adapters/notifier";

export const GET = withTenant(async (user) => {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: {
      category: { select: { name: true } },
      inventoryUnits: { where: { status: "IN_STOCK" }, select: { id: true } },
    },
  });

  const lowStock = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      categoryName: p.category?.name ?? null,
      onHand: p.inventoryUnits.length,
      safetyStock: p.safetyStock,
      deficit: p.safetyStock - p.inventoryUnits.length,
    }))
    .filter((p) => p.onHand <= p.safetyStock && p.safetyStock > 0);

  // Fire a single digest SMS to the owner if any low-stock (doc §4.1).
  if (lowStock.length > 0) {
    const tenant = await adminDb.tenant.findUnique({
      where: { id: user.tenantId },
      select: { phone: true, name: true },
    });
    if (tenant?.phone) {
      const notifier = getNotifier();
      await notifier.sendSms(
        tenant.phone,
        `Low-stock alert: ${lowStock.length} product(s) at or below safety stock. Check the dashboard.`
      );
    }
  }

  return NextResponse.json({ lowStock, count: lowStock.length });
});
