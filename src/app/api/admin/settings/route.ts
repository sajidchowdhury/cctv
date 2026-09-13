/**
 * GET  /api/admin/settings — read platform-wide payment settings (F6-S1).
 * POST /api/admin/settings — update payment settings (bulk-write to ALL tenants).
 *
 * Settings live on the Tenant model (bkashNumber, nagadNumber, bankDetails, monthlyFee).
 * The admin reads from the first tenant (platform default carrier) + writes to ALL
 * tenants so every tenant sees the same payment numbers + fee.
 *
 * Both endpoints are SUPER_ADMIN-only via withAdmin.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withAdmin } from "@/lib/admin-session";
import { formatBDT } from "@/lib/format";

const SettingsSchema = z.object({
  bkashNumber: z.string().max(30).optional().nullable(),
  nagadNumber: z.string().max(30).optional().nullable(),
  bankDetails: z.string().max(500).optional().nullable(),
  monthlyFee: z.number().min(0).optional(),
});

export const GET = withAdmin(async (_admin, _req: Request) => {
  // Read from the first tenant (platform default carrier).
  const tenant = await adminDb.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      bkashNumber: true, nagadNumber: true, bankDetails: true, monthlyFee: true,
    },
  });

  // Fall back to schema defaults if no tenant exists yet.
  const settings = {
    bkashNumber: tenant?.bkashNumber ?? null,
    nagadNumber: tenant?.nagadNumber ?? null,
    bankDetails: tenant?.bankDetails ?? null,
    monthlyFee: tenant?.monthlyFee ?? 500,
    monthlyFeeDisplay: formatBDT(tenant?.monthlyFee ?? 500),
  };

  return NextResponse.json({ settings });
});

export const POST = withAdmin(async (_admin, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { bkashNumber, nagadNumber, bankDetails, monthlyFee } = parsed.data;

  // Build the update payload — only set fields that were provided.
  const updateData: any = {};
  if (bkashNumber !== undefined) updateData.bkashNumber = bkashNumber || null;
  if (nagadNumber !== undefined) updateData.nagadNumber = nagadNumber || null;
  if (bankDetails !== undefined) updateData.bankDetails = bankDetails || null;
  if (monthlyFee !== undefined) updateData.monthlyFee = monthlyFee;

  // Bulk-update ALL tenants so they stay in sync.
  const result = await adminDb.tenant.updateMany({
    where: { deletedAt: null },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    updatedTenants: result.count,
    settings: {
      ...updateData,
      monthlyFeeDisplay: monthlyFee !== undefined ? formatBDT(monthlyFee) : undefined,
    },
    message: `Payment settings updated for ${result.count} tenant(s).`,
  });
});
