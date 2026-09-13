/**
 * GET /api/onboarding/status — returns the tenant's onboarding progress (doc §9).
 *
 * Checks: business profile set, has products, has suppliers, has at least one sale.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenantAny } from "@/lib/session";

export const GET = withTenantAny(async (user) => {
  const [products, suppliers, sales, tenant] = await Promise.all([
    db.product.count({ where: { deletedAt: null } }),
    db.supplier.count({ where: { deletedAt: null } }),
    db.sale.count({ where: { deletedAt: null, isHeld: false } }),
    db.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, phone: true, address: true } }),
  ]);

  const steps = {
    profile: !!(tenant?.name && tenant?.phone && tenant?.address),
    products: products > 0,
    suppliers: suppliers > 0,
    firstSale: sales > 0,
  };

  const completed = Object.values(steps).every(Boolean);
  const completedCount = Object.values(steps).filter(Boolean).length;

  return NextResponse.json({ steps, completed, completedCount, totalSteps: 4 });
});
