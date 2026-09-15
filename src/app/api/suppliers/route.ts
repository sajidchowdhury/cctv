/**
 * GET  /api/suppliers — list suppliers (tenant-scoped) with optional search.
 * POST /api/suppliers — create a supplier (doc §4.6).
 *
 * currentBalance starts equal to openingBalance (updated later by purchase/payment).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  openingBalance: z.number().default(0), // + = payable, − = advance
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const suppliers = await db.supplier.findMany({
    where: {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchases: true } },
    },
  });
  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      company: s.company,
      address: s.address,
      openingBalance: s.openingBalance,
      currentBalance: s.currentBalance,
      purchaseCount: s._count.purchases,
    })),
  });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { name, phone, company, address, openingBalance } = parsed.data;

  const supplier = await db.supplier.create({
    data: {
      tenantId: user.tenantId!,
      name,
      phone: phone ?? null,
      company: company ?? null,
      address: address ?? null,
      openingBalance,
      currentBalance: openingBalance, // start equal to opening
    },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      address: true,
      openingBalance: true,
      currentBalance: true,
    },
  });
  return NextResponse.json({ supplier }, { status: 201 });
});
