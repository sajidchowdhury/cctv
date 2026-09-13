/**
 * POST /api/quotations/[id]/convert (doc §5.6)
 *
 * One-click action copies quote line items into a new Sales Invoice with
 * stock reservation check. If any quoted product is out of stock, the
 * system flags it and offers to create a backorder Purchase.
 *
 * Creates a Sale (isHeld=true so the salesman reviews/finalizes in S11)
 * + SaleItems for each quote line. Quotation status → CONVERTED.
 *
 * Returns: the new sale ID + any out-of-stock flags.
 */
import { NextResponse } from "next/server";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

function genInvoiceNo(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `INV-${yy}${mm}${dd}-${rand}`;
}

export const POST = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const quote = await db.quotation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: {
              inventoryUnits: { where: { status: "IN_STOCK" }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!quote || quote.deletedAt) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  if (quote.status === "CONVERTED") {
    return NextResponse.json({ error: "Quotation already converted." }, { status: 409 });
  }

  // Stock check: flag out-of-stock products (doc §5.6).
  const stockWarnings: { productName: string; requested: number; available: number }[] = [];
  for (const item of quote.items) {
    if (item.lineType === "PRODUCT" && item.productId) {
      const available = item.product?.inventoryUnits.length ?? 0;
      if (item.qty > available) {
        stockWarnings.push({
          productName: item.product?.name ?? "Unknown",
          requested: item.qty,
          available,
        });
      }
    }
  }

  // Create the Sale + SaleItems (transactional).
  try {
    const result = await adminDb.$transaction(async (tx) => {
      const invoiceNo = genInvoiceNo();

      const sale = await tx.sale.create({
        data: {
          tenantId: quote.tenantId,
          customerId: quote.customerId,
          salesmanId: user.id,
          invoiceNo,
          date: new Date(),
          total: quote.total,
          discount: quote.discount,
          paid: 0,
          due: quote.total,
          mode: "DUE",
          quotationId: quote.id,
          isHeld: true, // salesman reviews + finalizes in S11
        },
      });

      // Copy quote items into SaleItems.
      for (const item of quote.items) {
        await tx.saleItem.create({
          data: {
            tenantId: quote.tenantId,
            saleId: sale.id,
            productId: item.productId || null,
            description: item.description,
            lineType: item.lineType === "PRODUCT" ? "PRODUCT" : "SERVICE",
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            warrantyMonths: 0, // set at sale finalization in S11
            lineTotal: item.lineTotal,
          },
        });
      }

      // Mark quotation as CONVERTED + link.
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: "CONVERTED", convertedSaleId: sale.id },
      });

      return sale;
    });

    return NextResponse.json({
      ok: true,
      saleId: result.id,
      invoiceNo: result.invoiceNo,
      stockWarnings,
      message:
        stockWarnings.length > 0
          ? `Converted to sale ${result.invoiceNo}. ${stockWarnings.length} product(s) out of stock — consider creating a backorder Purchase.`
          : `Converted to sale ${result.invoiceNo}. Review and finalize it.`,
    });
  } catch (err: any) {
    console.error("[quotations/convert] error:", err);
    return NextResponse.json({ error: "Failed to convert quotation." }, { status: 500 });
  }
});
