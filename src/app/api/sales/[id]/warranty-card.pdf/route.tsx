/**
 * GET /api/sales/[id]/warranty-card.pdf (doc §5.1)
 *
 * Generates a printable warranty card PDF per sold serial using react-pdf.
 * Card includes: product, serial, customer, sale date, warranty end, code.
 *
 * Returns binary PDF (Content-Type: application/pdf).
 */
import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: "Helvetica" },
  card: { borderWidth: 2, borderColor: "#1A73E8", borderRadius: 8, padding: 20 },
  header: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1A73E8", marginBottom: 4 },
  subheader: { fontSize: 10, color: "#666", marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 8 },
  label: { width: 100, color: "#666", fontSize: 10 },
  value: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 11 },
  serialBox: { marginTop: 12, padding: 12, backgroundColor: "#F0F6FF", borderRadius: 6, alignItems: "center" },
  serial: { fontSize: 18, fontFamily: "Courier-Bold", letterSpacing: 2 },
  codeLabel: { fontSize: 9, color: "#666", marginTop: 4 },
  footer: { marginTop: 16, fontSize: 9, color: "#999", textAlign: "center" },
  divider: { marginTop: 24, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: "#EEE" },
});

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true } },
      items: {
        include: {
          product: { select: { name: true, model: true, sku: true } },
          inventoryUnit: { select: { id: true, serialNo: true, warrantyEnd: true } },
        },
      },
    },
  });
  if (!sale || sale.deletedAt) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  // Filter items with warranty + serialised units.
  const warrantiedItems = sale.items.filter(
    (it) => it.inventoryUnit && it.inventoryUnit.warrantyEnd
  );

  if (warrantiedItems.length === 0) {
    return NextResponse.json(
      { error: "No warrantied serialised items in this sale." },
      { status: 404 }
    );
  }

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

  // Build a PDF with one card per warrantied item.
  const pdfBuffer = await renderToBuffer(
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: styles.page },
        warrantiedItems.map((it, idx) =>
          React.createElement(
            View,
            { key: it.id, style: idx > 0 ? { ...styles.card, marginTop: 16 } : styles.card },
            React.createElement(Text, { style: styles.header }, "WARRANTY CARD"),
            React.createElement(Text, { style: styles.subheader }, "CCTV Inventory SaaS"),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.label }, "Product"),
              React.createElement(Text, { style: styles.value }, it.product?.name ?? "—")
            ),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.label }, "Model"),
              React.createElement(Text, { style: styles.value }, it.product?.model ?? "—")
            ),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.label }, "Customer"),
              React.createElement(Text, { style: styles.value }, sale.customer?.name ?? "Walk-in")
            ),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.label }, "Sale date"),
              React.createElement(Text, { style: styles.value }, formatDate(sale.date))
            ),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.label }, "Warranty until"),
              React.createElement(Text, { style: styles.value }, formatDate(it.inventoryUnit!.warrantyEnd!))
            ),
            React.createElement(
              View,
              { style: styles.serialBox },
              React.createElement(Text, { style: styles.codeLabel }, "SERIAL NUMBER"),
              React.createElement(Text, { style: styles.serial }, it.inventoryUnit!.serialNo),
              React.createElement(Text, { style: styles.codeLabel }, `Invoice ${sale.invoiceNo}`)
            ),
            React.createElement(
              Text,
              { style: styles.footer },
              "Keep this card for warranty claims. Present with the product for service."
            )
          )
        )
      )
    )
  );

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="warranty-${sale.invoiceNo}.pdf"`,
    },
  });
});
