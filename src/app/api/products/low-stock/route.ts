/**
 * GET /api/products/low-stock — products at or below safety stock (doc §4.1).
 *
 * Pass ?notify=1 to fire the digest SMS to the owner (use after a sale reduces
 * stock, not on every dashboard read — otherwise the owner gets spammed).
 * Default (no param) is a silent read for the dashboard widget.
 *
 * F1-S2: onHand branches on product.isSerialised.
 */
import { NextResponse } from "next/server";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { getNotifier } from "@/lib/adapters/notifier";
import { computeOnHandBatch } from "@/lib/onhand";

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const notify = url.searchParams.get("notify") === "1";

  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      sku: true,
      safetyStock: true,
      isSerialised: true,
      category: { select: { name: true } },
    },
  });

  const onHandMap = await computeOnHandBatch(
    db,
    user.tenantId!,
    products.map((p) => ({ id: p.id, isSerialised: p.isSerialised }))
  );

  const lowStock = products
    .map((p) => {
      const onHand = onHandMap.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryName: p.category?.name ?? null,
        isSerialised: p.isSerialised,
        onHand,
        safetyStock: p.safetyStock,
        deficit: p.safetyStock - onHand,
      };
    })
    .filter((p) => p.onHand <= p.safetyStock && p.safetyStock > 0)
    .sort((a, b) => b.deficit - a.deficit);

  // Fire digest SMS only when explicitly requested (e.g. after a sale in S11).
  if (notify && lowStock.length > 0) {
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
