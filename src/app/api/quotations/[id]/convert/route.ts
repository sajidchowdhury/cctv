/**
 * POST /api/quotations/[id]/convert (doc §5.6)
 *
 * Phase D: serial number handling at conversion time.
 *
 * Request body (optional):
 *   {
 *     serials: { [quotationItemId]: ["inventoryUnitId1", "inventoryUnitId2", ...] }
 *   }
 *
 * - For serialised products: the user picks specific IN_STOCK serials via the
 *   serial picker modal. Each serial is validated (exists, IN_STOCK, belongs
 *   to the correct product). The selected serials are set as inventoryUnitId
 *   on the corresponding SaleItems + marked as SOLD.
 * - For non-serialised products: no serials needed (qty-based). SaleItems are
 *   created without inventoryUnitId.
 * - If `serials` is omitted or empty for a serialised line: the SaleItem is
 *   created without inventoryUnitId (serial picked later at sale finalization).
 *   The sale is created as isHeld=true so the salesman must finalize it.
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

export const POST = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  // Parse the optional serials from the request body.
  // Body may be empty (no serials picked — convert without assigning serials).
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK — convert without serials.
  }
  const serialsMap: Record<string, string[]> = body.serials ?? {};

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
  const productItems = quote.items.filter(
    (it) => it.lineType === "PRODUCT" && it.productId && it.product
  );
  const onHandMap = await computeOnHandBatch(
    db,
    quote.tenantId,
    productItems.map((it) => ({ id: it.productId!, isSerialised: it.product!.isSerialised }))
  );

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

  if (stockShortfalls.length > 0) {
    return NextResponse.json(
      {
        error: "Oversell blocked — insufficient stock for one or more products.",
        stockShortfalls,
      },
      { status: 409 }
    );
  }

  // ── Phase D: Validate selected serials ────────────────────────────
  // For each serialised product line where the user picked serials:
  //   1. Verify each unit exists + is IN_STOCK
  //   2. Verify the unit belongs to the correct product
  //   3. Verify the count matches the qty on the quotation line
  const serialErrors: string[] = [];
  const validatedSerials: Record<string, { unitId: string; saleItemId: string }[]> = {};

  for (const item of productItems) {
    if (!item.product?.isSerialised) continue; // non-serialised — skip
    const selectedUnitIds = serialsMap[item.id] ?? [];
    if (selectedUnitIds.length === 0) continue; // no serials picked — skip (picked later)

    // Validate count matches qty.
    if (selectedUnitIds.length !== item.qty) {
      serialErrors.push(
        `${item.product.name}: selected ${selectedUnitIds.length} serial(s) but qty is ${item.qty}.`
      );
      continue;
    }

    // Fetch the selected units + validate.
    const units = await adminDb.inventoryUnit.findMany({
      where: { id: { in: selectedUnitIds } },
      select: { id: true, status: true, productId: true, serialNo: true },
    });

    for (const unitId of selectedUnitIds) {
      const unit = units.find((u) => u.id === unitId);
      if (!unit) {
        serialErrors.push(`${item.product.name}: serial unit not found.`);
        continue;
      }
      if (unit.status !== "IN_STOCK") {
        serialErrors.push(`${item.product.name}: serial ${unit.serialNo} is ${unit.status} (not IN_STOCK).`);
        continue;
      }
      if (unit.productId !== item.productId) {
        serialErrors.push(`${item.product.name}: serial ${unit.serialNo} belongs to a different product.`);
        continue;
      }
    }

    if (serialErrors.length === 0) {
      validatedSerials[item.id] = selectedUnitIds.map((unitId) => ({
        unitId,
        saleItemId: "", // will be set after SaleItem creation
      }));
    }
  }

  if (serialErrors.length > 0) {
    return NextResponse.json(
      { error: "Serial validation failed.", serialErrors },
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
      // Phase D: for serialised products with selected serials, set inventoryUnitId
      // and mark the unit as SOLD.
      for (const item of quote.items) {
        const isSerialisedProduct = item.lineType === "PRODUCT" && item.product?.isSerialised;
        const selectedUnitIds = serialsMap[item.id] ?? [];

        if (isSerialisedProduct && selectedUnitIds.length > 0 && selectedUnitIds.length === item.qty) {
          // Serialised with picked serials: create one SaleItem per serial.
          for (const unitId of selectedUnitIds) {
            const saleItem = await tx.saleItem.create({
              data: {
                tenantId: quote.tenantId,
                saleId: sale.id,
                productId: item.productId || null,
                inventoryUnitId: unitId,
                description: item.description,
                lineType: "PRODUCT",
                qty: 1, // one unit per serial
                unitPrice: item.unitPrice,
                discount: item.discount,
                warrantyMonths: 0,
                lineTotal: item.unitPrice * (1 - item.discount / 100),
              },
            });
            // Mark the inventory unit as SOLD + link to this SaleItem.
            await tx.inventoryUnit.update({
              where: { id: unitId },
              data: { status: "SOLD", saleItemId: saleItem.id },
            });
          }
        } else {
          // Non-serialised, service, or serialised without picked serials:
          // create a single SaleItem without inventoryUnitId (qty-based).
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
              warrantyMonths: 0,
              lineTotal: item.lineTotal,
            },
          });
        }
      }

      // Mark quotation as CONVERTED + link.
      await tx.quotation.update({
        where: { id: quote.id },
        data: { status: "CONVERTED", convertedSaleId: sale.id },
      });

      return sale;
    });

    const serialsAssigned = Object.keys(validatedSerials).length > 0;
    return NextResponse.json({
      ok: true,
      saleId: result.id,
      invoiceNo: result.invoiceNo,
      message: serialsAssigned
        ? `Converted to sale ${result.invoiceNo}. Serials assigned + marked as SOLD. Review and finalize.`
        : `Converted to sale ${result.invoiceNo}. Review and finalize — pick serials during finalization.`,
    });
  } catch (err: any) {
    console.error("[quotations/convert] error:", err);
    return NextResponse.json({ error: "Failed to convert quotation." }, { status: 500 });
  }
});
