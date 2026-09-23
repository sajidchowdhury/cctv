/**
 * GET /api/sales/[id]/warranty-card.pdf (doc §5.1)
 *
 * Generates a single printable warranty card PDF for ALL warrantied items
 * in a sale — not one card per item.
 *
 * Why single card?
 *   - User requested: "if an invoice has 5 items with warranty, create a
 *     single warranty card for all of those 5 products, not separate cards."
 *   - Cleaner for the customer to keep one card per invoice.
 *   - The card includes a per-item table: SL, Product, Model, Serial,
 *     Warranty until. All on one card.
 *
 * Page-break safety:
 *   - react-pdf wraps content in <Page> elements. A single Page has fixed
 *     height (A4 = 842pt). If the items table overflows, react-pdf silently
 *     clips it (no auto-pagination like a browser).
 *   - To prevent clipping, we chunk items: if >N items (default 15), split
 *     into multiple Page elements, each with its own card header + the next
 *     chunk of items. The card's bottom border + footer are only rendered
 *     on the LAST page so the card looks continuous.
 *   - For typical sales (1–15 warrantied items), the card fits on one page.
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
  card: {
    borderWidth: 2,
    borderColor: "#1A73E8",
    borderRadius: 8,
    padding: 20,
    // Flex column so the footer sits at the bottom of the card.
    flexDirection: "column",
    // minHeight forces the card to fill the page height so the border
    // looks like a proper card even with few items.
    minHeight: "100%",
  },
  cardTop: {
    // Header section of the card.
  },
  header: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1A73E8", marginBottom: 4 },
  subheader: { fontSize: 10, color: "#666", marginBottom: 12 },
  metaRow: { flexDirection: "row", marginBottom: 6 },
  metaLabel: { width: 100, color: "#666", fontSize: 10 },
  metaValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 11 },

  // Items table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F0F6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#1A73E8",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 12,
  },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1A73E8" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableCell: { fontSize: 10, color: "#000" },
  // Column widths (must sum to ~100% of available width).
  colSl: { width: "8%" },
  colProduct: { width: "32%" },
  colModel: { width: "25%" },
  colSerial: { width: "20%", fontFamily: "Courier", fontSize: 9 },
  colWarranty: { width: "15%" },

  footer: { marginTop: 16, fontSize: 9, color: "#999", textAlign: "center" },
});

// Maximum number of items per Page. A4 with the styles above comfortably fits
// ~15 items before content gets clipped. We chunk to be safe.
const ITEMS_PER_PAGE = 12;

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

  // ── Chunk items into pages so the card doesn't overflow the page. ──
  // Each chunk becomes a <Page> in the PDF. The card header + meta info is
  // shown on every page (so each page is self-identifiable), but the footer
  // "Keep this card..." only renders on the last page (so the card looks
  // continuous across pages).
  const pages: typeof warrantiedItems[] = [];
  for (let i = 0; i < warrantiedItems.length; i += ITEMS_PER_PAGE) {
    pages.push(warrantiedItems.slice(i, i + ITEMS_PER_PAGE));
  }
  const lastPageIndex = pages.length - 1;

  const pdfBuffer = await renderToBuffer(
    React.createElement(
      Document,
      null,
      pages.map((chunk, pageIdx) =>
        React.createElement(
          Page,
          { key: pageIdx, size: "A4", style: styles.page },
          React.createElement(
            View,
            { style: styles.card },
            // ── Card header (on every page) ──
            React.createElement(View, { style: styles.cardTop },
              React.createElement(Text, { style: styles.header }, "WARRANTY CARD"),
              React.createElement(Text, { style: styles.subheader }, "CCTV Inventory SaaS"),
              // Meta info: customer, sale date, invoice no
              React.createElement(
                View,
                { style: styles.metaRow },
                React.createElement(Text, { style: styles.metaLabel }, "Customer"),
                React.createElement(Text, { style: styles.metaValue }, sale.customer?.name ?? "Walk-in")
              ),
              React.createElement(
                View,
                { style: styles.metaRow },
                React.createElement(Text, { style: styles.metaLabel }, "Phone"),
                React.createElement(Text, { style: styles.metaValue }, sale.customer?.phone ?? "—")
              ),
              React.createElement(
                View,
                { style: styles.metaRow },
                React.createElement(Text, { style: styles.metaLabel }, "Invoice no."),
                React.createElement(Text, { style: styles.metaValue }, sale.invoiceNo)
              ),
              React.createElement(
                View,
                { style: styles.metaRow },
                React.createElement(Text, { style: styles.metaLabel }, "Sale date"),
                React.createElement(Text, { style: styles.metaValue }, formatDate(sale.date))
              )
            ),

            // ── Items table header ──
            React.createElement(
              View,
              { style: styles.tableHeader },
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colSl] }, "SL"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colProduct] }, "Product"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colModel] }, "Model"),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colSerial] }, "Serial No."),
              React.createElement(Text, { style: [styles.tableHeaderCell, styles.colWarranty] }, "Warranty until")
            ),

            // ── Items table rows ──
            chunk.map((it, idx) =>
              React.createElement(
                View,
                { key: it.id, style: styles.tableRow, wrap: false },
                React.createElement(Text, { style: [styles.tableCell, styles.colSl] }, String(pageIdx * ITEMS_PER_PAGE + idx + 1)),
                React.createElement(Text, { style: [styles.tableCell, styles.colProduct] }, it.product?.name ?? "—"),
                React.createElement(Text, { style: [styles.tableCell, styles.colModel] }, it.product?.model ?? "—"),
                React.createElement(Text, { style: [styles.tableCell, styles.colSerial] }, it.inventoryUnit?.serialNo ?? "—"),
                React.createElement(Text, { style: [styles.tableCell, styles.colWarranty] }, formatDate(it.inventoryUnit!.warrantyEnd!))
              )
            ),

            // ── Footer (only on last page) ──
            pageIdx === lastPageIndex
              ? React.createElement(
                  Text,
                  { style: styles.footer },
                  "Keep this card for warranty claims. Present with the product for service."
                )
              : React.createElement(Text, { style: styles.footer },
                  `Page ${pageIdx + 1} of ${pages.length} — continued on next page.`
                )
          )
        )
      )
    )
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="warranty-${sale.invoiceNo}.pdf"`,
    },
  });
});
