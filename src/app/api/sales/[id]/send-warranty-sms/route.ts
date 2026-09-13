/**
 * POST /api/sales/[id]/send-warranty-sms (doc §5.1)
 *
 * Sends the warranty code to the customer's phone via INotifier.
 * In dev, the ConsoleNotifier logs the SMS to stdout.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { getNotifier } from "@/lib/adapters/notifier";

export const POST = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true } },
      items: {
        include: {
          inventoryUnit: { select: { serialNo: true, warrantyEnd: true } },
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!sale || sale.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  const warrantied = sale.items.filter(
    (it) => it.inventoryUnit && it.inventoryUnit.warrantyEnd
  );
  if (warrantied.length === 0) {
    return NextResponse.json(
      { error: "No warrantied serialised items in this sale." },
      { status: 404 }
    );
  }

  const phone = sale.customer?.phone;
  if (!phone) {
    return NextResponse.json(
      { error: "Customer has no phone number on file." },
      { status: 422 }
    );
  }

  const notifier = getNotifier();
  const dateStr = sale.date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // One SMS per sale (digest): list serials + warranty end.
  const serialsList = warrantied
    .map((it) => `${it.product.name}: ${it.inventoryUnit!.serialNo}`)
    .join(", ");
  const firstEnd = warrantied[0].inventoryUnit!.warrantyEnd!;
  const endStr = firstEnd.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  await notifier.sendSms(
    phone,
    `Warranty confirmed for ${sale.customer!.name}. Invoice ${sale.invoiceNo} (${dateStr}). ` +
      `Serials: ${serialsList}. Warranty valid until ${endStr}. Keep this message for service claims.`
  );

  return NextResponse.json({
    ok: true,
    phone,
    serialsCount: warrantied.length,
    message: `Warranty SMS sent to ${phone}.`,
  });
});
