/**
 * GET   /api/quotations/[id] — fetch a single quotation with items.
 * PATCH /api/quotations/[id] — update status (SENT / ACCEPTED / REJECTED + lossReason).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const quote = await db.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, address: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, model: true } } },
      },
    },
  });
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  return NextResponse.json({
    quotation: {
      ...quote,
      items: quote.items.map((it) => ({ ...it, product: it.product })),
    },
  });
});

const PatchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
  lossReason: z.string().max(300).optional().nullable(),
  termsConditions: z.string().max(2000).optional().nullable(),
});

export const PATCH = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  // Reject requires a reason (doc §5.6).
  if (parsed.data.status === "REJECTED" && !parsed.data.lossReason) {
    return NextResponse.json({ error: "A loss reason is required when rejecting." }, { status: 422 });
  }

  const quote = await db.quotation.update({
    where: { id },
    data: parsed.data,
    select: { id: true, quoteNo: true, status: true },
  });
  return NextResponse.json({ quotation: quote });
});
