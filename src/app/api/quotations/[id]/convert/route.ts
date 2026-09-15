/**
 * POST /api/quotations/[id]/convert (doc §5.6)
 *
 * One-click action copies quote line items into a new Sales Invoice with
 * stock check. If any quoted product is out of stock, returns 409 Conflict
 * with the list of short items — the user must fix stock (purchase more)
 * or adjust the quotation before converting.
 *
 * Creates a Sale (isHeld=true so the salesman reviews/finalizes in S11)
 * + SaleItems for each quote line. Quotation status → CONVERTED.
 *
 * Stock check uses computeOnHandBatch (shared helper) which correctly
 * handles both serialised products (count of IN_STOCK InventoryUnits) and
 * non-serialised products (ΣPurchaseItem.qty − ΣSaleItem.qty).
 */
import { NextResponse } from "next/server";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { computeOnHandBatch } from "@/lib/onhand";

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
            select: { id: true, name: true, isSerialised: true },
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

  // ── Stock check (oversell protection) ────────────────────────────
  // Use computeOnHandBatch to get accurate on-hand for ALL product types:
  //   - Serialised (cameras/DVRs): count of IN_STOCK InventoryUnits
  //   - Non-serialised (cables/PSU): ΣPurchaseItem.qty − ΣSaleItem.qty
  // Service/LABOR lines have no stock — skipped.
  const productItems = quote.items.filter(
    (it) => it.lineType === "PRODUCT" && it.productId && it.product
  );
  const onHandMap = await computeOnHandBatch(
    db,
    quote.tenantId,
    productItems.map((it) => ({ id: it.productId!, isSerialised: it.product!.isSerialised }))
  );

  // Aggregate requested qty per product (a quotation may have multiple lines
  // for the same product).
  const requestedMap = new Map<string, number>();
  for (const it of productItems) {
    requestedMap.set(it.productId!, (requestedMap.get(it.productId!) ?? 0) + it.qty);
  }

  const stockShortfalls: { productName: string; requested: number; available: number }[] = [];
  for (const [pid, requestedQty] of requestedMap.entries()) {
    const available = onHandMap.get(pid) ?? 0;
    if (requestedQty > available) {
      const item = productItems.find((it) => it.productId === pid);
      stockShortfalls.push({
        productName: item?.product?.name ?? "Unknown",
        requested: requestedQty,
        available,
      });
    }
  }

  // Hard block: don't create a sale if any product is oversold.
  // The user must fix stock (purchase more) or adjust the quotation first.
  if (stockShortfalls.length > 0) {
    return NextResponse.json(
      {
        error: "Oversell blocked — insufficient stock for one or more products.",
        stockShortfalls,
      },
      { status: 409 }
    );
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
      message: `Converted to sale ${result.invoiceNo}. Review and finalize it.`,
    });
  } catch (err: any) {
    console.error("[quotations/convert] error:", err);
    return NextResponse.json({ error: "Failed to convert quotation." }, { status: 500 });
  }
});
