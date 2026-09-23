/**
 * GET /api/sales/[id]/warranty-card.pdf (doc §5.1)
 *
 * Generates a single printable warranty card PDF for ALL warrantied items
 * in a sale. The card is "branded" with the tenant's business profile:
 *   - Business logo (if uploaded) at the top-left
 *   - Business name + phone + address
 *   - Accent color (from profile, default #1A73E8) for borders + headings
 *   - Customer + invoice meta info
 *   - Items table with accent-colored header row
 *   - Customer signature + Authorised signature lines at the bottom
 *   - Verification note explaining how to use the card
 *
 * Page-break safety:
 *   - react-pdf wraps content in <Page> elements. A single Page has fixed
 *     height (A4 = 842pt). If the items table overflows, react-pdf silently
 *     clips it (no auto-pagination like a browser).
 *   - To prevent clipping, we chunk items: if >ITEMS_PER_PAGE, split into
 *     multiple Page elements, each with its own card header + the next
 *     chunk of items. The card's footer + signatures only render on the
 *     LAST page so the card looks continuous.
 *   - For typical sales (1–12 warrantied items), the card fits on one page.
 *
 * Logo handling:
 *   - react-pdf's <Image> supports HTTP URLs + data URIs + Buffer.
 *   - We fetch the logo via the local storage adapter (same path the browser
 *     uses: /api/uploads/...). To avoid auth complications (the uploads
 *     route requires a session), we read the file directly from disk using
 *     the LocalStorageDriver's UPLOAD_DIR.
 *   - If the logo file doesn't exist or can't be read, we silently skip the
 *     logo and show a text-only header. The card still renders correctly.
 *
 * Returns binary PDF (Content-Type: application/pdf).
 */
import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    // Flex column so the footer/signatures can sit at the bottom.
    flexDirection: "column",
  },
  card: {
    borderWidth: 2,
    // borderColor is set inline (accent color)
    borderRadius: 8,
    padding: 20,
    flexDirection: "column",
    minHeight: "100%",
  },
  // ── Header section (business logo + business info + "Warranty Card" title) ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    // borderBottomColor is set inline (accent color, light tint)
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  logo: { width: 60, height: 60, marginRight: 12, objectFit: "contain" },
  headerBusinessName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerPhone: { fontSize: 10, color: "#666", marginBottom: 1 },
  headerAddress: { fontSize: 10, color: "#666" },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  headerInvoiceNo: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  headerDate: { fontSize: 10, color: "#666", marginTop: 2 },

  // ── Meta info section ──
  metaSection: { marginBottom: 14 },
  metaTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: 100, color: "#666", fontSize: 10 },
  metaValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 11 },

  // ── Items table ──
  tableHeader: {
    flexDirection: "row",
    // backgroundColor is set inline (accent color, light tint)
    borderBottomWidth: 1,
    // borderBottomColor is set inline (accent color)
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableCell: { fontSize: 10, color: "#000" },
  // Column widths (must sum to ~100% of available width).
  colSl: { width: "6%" },
  colProduct: { width: "32%" },
  colModel: { width: "25%" },
  colSerial: { width: "22%", fontFamily: "Courier", fontSize: 9 },
  colWarranty: { width: "15%" },

  // ── Footer + signatures ──
  footerSpacer: { flex: 1, minHeight: 30 },
  signaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    marginBottom: 12,
  },
  signatureBox: { width: "45%" },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: "#999", marginBottom: 4 },
  signatureLabel: { fontSize: 9, color: "#666", textAlign: "center" },
  footerNote: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    fontSize: 9,
    color: "#999",
    textAlign: "center",
  },
  footerContinue: { marginTop: 12, fontSize: 9, color: "#999", textAlign: "center" },
});

// Maximum number of items per Page. A4 with the styles above comfortably fits
// ~12 items before content gets clipped.
const ITEMS_PER_PAGE = 12;

export const GET = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  // ── Fetch sale + tenant business profile in parallel ──────────────
  const [sale, tenant] = await Promise.all([
    db.sale.findUnique({
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
    }),
    db.tenant.findUnique({
      where: { id: user.tenantId! },
      select: {
        name: true,
        phone: true,
        address: true,
        businessLogo: true,
        invoiceAccentColor: true,
      },
    }),
  ]);

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

  // ── Branding ──────────────────────────────────────────────────────
  const accent = tenant?.invoiceAccentColor ?? "#1A73E8";
  const accentLight = `${accent}12`; // ~7% opacity for table header bg
  const businessName = tenant?.name ?? "CCTV Inventory SaaS";
  const businessPhone = tenant?.phone ?? null;
  const businessAddress = tenant?.address ?? null;

  // ── Logo: read from disk if uploaded ──────────────────────────────
  // The businessLogo URL is stored as "/api/uploads/<key>" (routed through
  // our GET /api/uploads/[...path] handler). The actual file is at
  // ./uploads/<key> on disk. We read it directly to avoid auth complications.
  let logoDataUri: string | null = null;
  if (tenant?.businessLogo) {
    try {
      // Strip leading "/api/uploads/" or "/uploads/" to get the key.
      let key = tenant.businessLogo;
      if (key.startsWith("/api/uploads/")) key = key.slice("/api/uploads/".length);
      else if (key.startsWith("/uploads/")) key = key.slice("/uploads/".length);
      else if (key.startsWith("http")) key = ""; // absolute URL — skip, we don't fetch remote

      if (key) {
        const filePath = path.join(UPLOAD_DIR, key);
        const buf = await fs.readFile(filePath);
        // Detect content type from extension.
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          ext === ".png" ? "image/png" :
          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
          ext === ".webp" ? "image/webp" :
          ext === ".gif" ? "image/gif" :
          "image/png"; // default
        logoDataUri = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      // Logo file missing or unreadable — skip silently.
      logoDataUri = null;
    }
  }

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

  // ── Chunk items into pages so the card doesn't overflow the page. ──
  const pages: typeof warrantiedItems[] = [];
  for (let i = 0; i < warrantiedItems.length; i += ITEMS_PER_PAGE) {
    pages.push(warrantiedItems.slice(i, i + ITEMS_PER_PAGE));
  }
  const lastPageIndex = pages.length - 1;

  // ── Helper: render the header (used on every page) ──
  const renderHeader = () =>
    React.createElement(
      View,
      { style: [styles.headerRow, { borderBottomColor: `${accent}33` }] },
      // Left: logo + business info
      React.createElement(
        View,
        { style: styles.headerLeft },
        logoDataUri
          ? React.createElement(Image, { style: styles.logo, src: logoDataUri })
          : null,
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.headerBusinessName }, businessName),
          businessPhone && React.createElement(Text, { style: styles.headerPhone }, `Phone: ${businessPhone}`),
          businessAddress && React.createElement(Text, { style: styles.headerAddress }, businessAddress)
        )
      ),
      // Right: "Warranty Card" title + invoice no + date
      React.createElement(
        View,
        { style: styles.headerRight },
        React.createElement(Text, { style: [styles.headerTitle, { color: accent }] }, "Warranty Card"),
        React.createElement(Text, { style: styles.headerInvoiceNo }, sale.invoiceNo),
        React.createElement(Text, { style: styles.headerDate }, formatDate(sale.date))
      )
    );

  // ── Helper: render the meta info section ──
  const renderMeta = () =>
    React.createElement(
      View,
      { style: styles.metaSection },
      React.createElement(Text, { style: [styles.metaTitle, { color: accent }] }, "Customer & Invoice Details"),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(Text, { style: styles.metaLabel }, "Customer"),
        React.createElement(Text, { style: styles.metaValue }, sale.customer?.name ?? "Walk-in customer")
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
    );

  // ── Helper: render the items table ──
  const renderItemsTable = (chunk: typeof warrantiedItems, pageIdx: number) =>
    React.createElement(
      View,
      null,
      // Table header
      React.createElement(
        View,
        { style: [styles.tableHeader, { backgroundColor: accentLight, borderBottomColor: accent }] },
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.colSl, { color: accent }] }, "SL"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.colProduct, { color: accent }] }, "Product"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.colModel, { color: accent }] }, "Model"),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.colSerial, { color: accent }] }, "Serial No."),
        React.createElement(Text, { style: [styles.tableHeaderCell, styles.colWarranty, { color: accent }] }, "Warranty until")
      ),
      // Table rows
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
      )
    );

  // ── Helper: render signatures + footer (last page only) ──
  const renderSignatures = () =>
    React.createElement(
      View,
      null,
      React.createElement(View, { style: styles.footerSpacer }),
      // Signatures
      React.createElement(
        View,
        { style: styles.signaturesRow },
        React.createElement(
          View,
          { style: styles.signatureBox },
          React.createElement(View, { style: styles.signatureLine }),
          React.createElement(Text, { style: styles.signatureLabel }, "Customer Signature")
        ),
        React.createElement(
          View,
          { style: styles.signatureBox },
          React.createElement(View, { style: styles.signatureLine }),
          React.createElement(Text, { style: styles.signatureLabel }, "Authorised Signature")
        )
      ),
      // Footer note
      React.createElement(
        Text,
        { style: styles.footerNote },
        "This card is valid for warranty claims on the items listed above. Present this card with the product(s) for service. " +
        "Warranty is void if the product is tampered with or damaged due to misuse. " +
        `Keep this card safe — replacement may not be issued.`
      )
    );

  // ── Build the PDF ──
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
            { style: [styles.card, { borderColor: accent }] },
            renderHeader(),
            renderMeta(),
            renderItemsTable(chunk, pageIdx),
            // Footer: signatures + note on last page; "continued" on others.
            pageIdx === lastPageIndex
              ? renderSignatures()
              : React.createElement(
                  Text,
                  { style: styles.footerContinue },
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
