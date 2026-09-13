/**
 * GET  /api/quotations — list quotations (tenant-scoped) with status filter.
 * POST /api/quotations — create a quotation with PRODUCT/LABOR/SERVICE lines.
 *
 * Doc §5.6: pre-sale project estimation. Quote No auto QT-YYMMDD-###.
 * Status: DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED | CONVERTED.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const ItemSchema = z.object({
  productId: z.string().optional().nullable(),
  lineType: z.enum(["PRODUCT", "LABOR", "SERVICE"]).default("PRODUCT"),
  description: z.string().min(1).max(200),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

const CreateSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(100).optional().nullable(),
  siteAddress: z.string().max(300).optional().nullable(),
  projectType: z.enum(["CORPORATE", "FACTORY", "RESIDENTIAL", "RETAIL", "OTHER"]).default("OTHER"),
  discount: z.number().min(0).default(0),
  vat: z.number().min(0).default(0),
  validUntilDays: z.number().int().min(1).max(365).default(15),
  termsConditions: z.string().max(2000).optional().nullable(),
  items: z.array(ItemSchema).min(1),
});

function genQuoteNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `QT-${yy}${mm}${dd}-${rand}`;
}

export const GET = withTenant(async (user, req: Request) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const search = url.searchParams.get("q") ?? "";

  const quotes = await db.quotation.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search ? { quoteNo: { contains: search } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: { select: { id: true, lineTotal: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({
    quotations: quotes.map((q) => ({
      id: q.id,
      quoteNo: q.quoteNo,
      date: q.date,
      customerName: q.customerName ?? q.customer?.name ?? "Walk-in prospect",
      projectType: q.projectType,
      total: q.total,
      status: q.status,
      itemCount: q.items.length,
      validUntil: q.validUntil,
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
  const { customerId, customerName, siteAddress, projectType, discount, vat, validUntilDays, termsConditions, items } = parsed.data;
  const tenantId = user.tenantId!;

  // Compute subtotal + total.
  let subtotal = 0;
  for (const item of items) {
    const lineTotal = item.qty * item.unitPrice * (1 - item.discount / 100);
    subtotal += lineTotal;
  }
  const total = subtotal - discount + (subtotal * vat) / 100;

  const quoteNo = genQuoteNo();
  const validUntil = new Date(Date.now() + validUntilDays * 24 * 60 * 60 * 1000);

  try {
    const quotation = await adminDb.$transaction(async (tx) => {
      const quote = await tx.quotation.create({
        data: {
          tenantId,
          customerId: customerId || null,
          customerName: customerName || null,
          quoteNo,
          siteAddress: siteAddress || null,
          projectType,
          subtotal,
          discount,
          vat,
          total,
          validUntil,
          status: "DRAFT",
          termsConditions: termsConditions || null,
        },
      });

      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice * (1 - item.discount / 100);
        await tx.quotationItem.create({
          data: {
            tenantId,
            quotationId: quote.id,
            productId: item.productId || null,
            lineType: item.lineType,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal,
          },
        });
      }
      return quote;
    });

    return NextResponse.json(
      { id: quotation.id, quoteNo: quotation.quoteNo, total: quotation.total },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Quote number collision. Try again." }, { status: 409 });
    }
    console.error("[quotations/create] error:", err);
    return NextResponse.json({ error: "Failed to create quotation." }, { status: 500 });
  }
});
