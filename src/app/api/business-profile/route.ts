/**
 * GET  /api/business-profile — fetch the current tenant's business profile + invoice settings.
 * PATCH /api/business-profile — update business profile fields (name, logo, invoice images, etc.).
 *
 * Phase F-S1: Business Profile + Invoice Customization.
 * Separate from the subscription/billing settings — this is for business identity +
 * invoice branding.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user) => {
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId! },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      businessLogo: true,
      invoiceHeaderImage: true,
      invoiceFooterImage: true,
      invoiceProductsPerPage: true,
      invoiceAccentColor: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ profile: tenant });
});

// Accepts absolute URLs (https://...) and root-relative paths (/uploads/...).
// The LocalStorageDriver returns root-relative URLs, so .url() alone breaks uploads.
const urlString = z
  .string()
  .regex(/^(https?:\/\/|\/).+/, "Must be a URL or root-relative path like /uploads/...")
  .nullable()
  .optional();

const PatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  businessLogo: urlString,
  invoiceHeaderImage: urlString,
  invoiceFooterImage: urlString,
  invoiceProductsPerPage: z.number().int().min(1).max(50).optional(),
  invoiceAccentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const PATCH = withTenant(async (user, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await db.tenant.update({
    where: { id: user.tenantId! },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      businessLogo: true,
      invoiceHeaderImage: true,
      invoiceFooterImage: true,
      invoiceProductsPerPage: true,
      invoiceAccentColor: true,
    },
  });

  return NextResponse.json({ profile: updated });
});
