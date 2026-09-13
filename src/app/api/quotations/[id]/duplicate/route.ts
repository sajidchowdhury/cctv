/**
 * POST /api/quotations/[id]/duplicate (doc §5.6)
 *
 * Clones an existing quote to quickly re-quote a similar site.
 * New quote starts in DRAFT status with a new quote number.
 */
import { NextResponse } from "next/server";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

function genQuoteNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `QT-${yy}${mm}${dd}-${rand}`;
}

export const POST = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const original = await db.quotation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!original || original.deletedAt) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  try {
    const clone = await adminDb.$transaction(async (tx) => {
      const newQuote = await tx.quotation.create({
        data: {
          tenantId: original.tenantId,
          customerId: original.customerId,
          customerName: original.customerName,
          quoteNo: genQuoteNo(),
          siteAddress: original.siteAddress,
          projectType: original.projectType,
          subtotal: original.subtotal,
          discount: original.discount,
          vat: original.vat,
          total: original.total,
          validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: "DRAFT",
          termsConditions: original.termsConditions,
        },
      });

      for (const item of original.items) {
        await tx.quotationItem.create({
          data: {
            tenantId: item.tenantId,
            quotationId: newQuote.id,
            productId: item.productId,
            lineType: item.lineType,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: item.lineTotal,
          },
        });
      }
      return newQuote;
    });

    return NextResponse.json(
      { ok: true, id: clone.id, quoteNo: clone.quoteNo, message: `Duplicated as ${clone.quoteNo}.` },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[quotations/duplicate] error:", err);
    return NextResponse.json({ error: "Failed to duplicate quotation." }, { status: 500 });
  }
});
