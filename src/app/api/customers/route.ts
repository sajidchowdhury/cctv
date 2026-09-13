/**
 * GET  /api/customers — list customers (tenant-scoped) with search.
 * POST /api/customers — create a customer (minimal; full UI in S14).
 *
 * S10 needs customers for the quotation form. The full customer master +
 * ledger preview lands in S14.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  type: z.enum(["RETAIL", "INSTALLER"]).default("RETAIL"),
  openingBalance: z.number().default(0),
});

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const customers = await db.customer.findMany({
    where: {
      deletedAt: null,
      ...(search
        ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, type: true, currentBalance: true },
  });
  return NextResponse.json({ customers });
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { name, phone, address, type, openingBalance } = parsed.data;
  const customer = await db.customer.create({
    data: {
      tenantId: user.tenantId!,
      name,
      phone: phone ?? null,
      address: address ?? null,
      type,
      openingBalance,
      currentBalance: openingBalance,
    },
    select: { id: true, name: true, phone: true },
  });
  return NextResponse.json({ customer }, { status: 201 });
});
