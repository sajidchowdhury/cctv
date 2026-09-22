"use client";

/**
 * InvoiceDocument — shared invoice renderer for on-screen + print.
 *
 * Two render paths in one component:
 *   - printMode=false (default): uses Tailwind classes — for the on-screen
 *     invoice Card on /sales/[id].
 *   - printMode=true: uses inline styles — for the bare print page at
 *     /print/sales/[id]. Inline styles have the highest CSS specificity,
 *     guaranteeing the invoice renders correctly in the browser's print
 *     preview (no Tailwind / @media print / dark-mode overrides).
 *
 * Why shared?
 *   - The markup was previously duplicated between two files. Phase 2 of the
 *     implementation plan changes the table structure (warranty column + new
 *     item layout). Having one source of truth means the change happens in
 *     one place.
 *
 * NOTE: When changing the invoice layout, update BOTH render paths in this
 *       file (the Tailwind one + the inline-style one). They must stay in
 *       sync visually.
 */
import { useMemo } from "react";
import { formatBDT, formatDateTime } from "@/lib/format";
import { assetUrl } from "@/lib/app-path";
import { groupInvoiceItems, paginateItems } from "@/lib/invoice-grouping";

export type InvoiceProfile = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  businessLogo?: string | null;
  invoiceHeaderImage?: string | null;
  invoiceFooterImage?: string | null;
  invoiceProductsPerPage?: number | null;
  invoiceAccentColor?: string | null;
};

export function InvoiceDocument({
  sale,
  profile,
  printMode = false,
}: {
  sale: any;
  profile: InvoiceProfile | null | undefined;
  printMode?: boolean;
}) {
  // ── Shared derived state ─────────────────────────────────────────
  const groupedItems = useMemo(
    () => groupInvoiceItems(sale?.items ?? []),
    [sale]
  );
  const productsPerPage = profile?.invoiceProductsPerPage ?? 10;
  const invoicePages = useMemo(
    () => paginateItems(groupedItems, productsPerPage),
    [groupedItems, productsPerPage]
  );

  const accent = profile?.invoiceAccentColor ?? "#1A73E8";
  const headerImg = profile?.invoiceHeaderImage ?? null;
  const footerImg = profile?.invoiceFooterImage ?? null;
  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;
  const businessPhone = profile?.phone ?? null;
  const businessAddress = profile?.address ?? null;

  return printMode ? (
    <PrintInvoice
      sale={sale}
      groupedItems={groupedItems}
      invoicePages={invoicePages}
      accent={accent}
      headerImg={headerImg}
      footerImg={footerImg}
      businessName={businessName}
      businessLogo={businessLogo}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    />
  ) : (
    <ScreenInvoice
      sale={sale}
      groupedItems={groupedItems}
      invoicePages={invoicePages}
      accent={accent}
      headerImg={headerImg}
      footerImg={footerImg}
      businessName={businessName}
      businessLogo={businessLogo}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    />
  );
}

// ─── Shared prop shape for the two renderers ────────────────────────────
type RendererProps = {
  sale: any;
  groupedItems: ReturnType<typeof groupInvoiceItems>;
  invoicePages: ReturnType<typeof paginateItems>;
  accent: string;
  headerImg: string | null;
  footerImg: string | null;
  businessName: string;
  businessLogo: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
};

// ════════════════════════════════════════════════════════════════════
//  ON-SCREEN RENDERER (Tailwind classes)
//  Used by /cctv/sales/<id> — inside a Card, in the app shell.
// ════════════════════════════════════════════════════════════════════
function ScreenInvoice({
  sale,
  groupedItems,
  invoicePages,
  accent,
  headerImg,
  footerImg,
  businessName,
  businessLogo,
  businessPhone,
  businessAddress,
}: RendererProps) {
  return (
    <div className="rounded-lg border overflow-hidden bg-white text-black print:shadow-none">
      {/* Custom header image OR default header (with logo + business name) */}
      {headerImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(headerImg) ?? ""} alt="Invoice header" className="w-full h-24 object-cover" />
      ) : (
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: accent, backgroundColor: `${accent}08` }}>
          <div className="flex items-center gap-2">
            {businessLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(businessLogo) ?? ""} alt="Logo" className="h-10 w-10 rounded object-contain" />
            )}
            <div>
              <h2 className="text-lg font-bold" style={{ color: accent }}>{businessName}</h2>
              {businessPhone && <p className="text-xs text-gray-500">{businessPhone}</p>}
              {businessAddress && <p className="text-xs text-gray-500">{businessAddress}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice</p>
            <p className="font-bold text-sm" style={{ color: accent }}>{sale.invoiceNo}</p>
            <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
          </div>
        </div>
      )}

      {/* When a custom header image is set, the logo + business name are already
          part of that image — so we skip the separate logo block and go straight
          to Bill-to. Invoice no + date show on the right of the Bill-to row so
          they aren't lost. */}

      {/* Customer + salesman + (invoice no if header image is set) */}
      <div className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bill to</p>
          <p className="font-medium">{sale.customer?.name ?? "Walk-in customer"}</p>
          {sale.customer?.phone && <p className="text-xs text-gray-500">{sale.customer.phone}</p>}
          {sale.customer?.address && <p className="text-xs text-gray-500">{sale.customer.address}</p>}
        </div>
        <div className="text-right">
          {headerImg && (
            <>
              <p className="font-bold text-sm" style={{ color: accent }}>{sale.invoiceNo}</p>
              <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
            </>
          )}
          {sale.salesman && <p className="text-xs text-gray-500">Salesman: {sale.salesman.name}</p>}
          <p className="text-xs text-gray-500">Payment: {sale.mode}</p>
        </div>
      </div>

      {/* Items table (grouped by product — MODEL NAME (PRODUCT NAME) + serial list) */}
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full text-sm">
          <thead className="border-b" style={{ borderColor: accent }}>
            <tr>
              <th className="text-left font-medium py-2 pr-2" style={{ color: accent }}>Item</th>
              <th className="text-left font-medium py-2 px-2" style={{ color: accent }}>Serials</th>
              <th className="text-right font-medium py-2 px-2" style={{ color: accent }}>Qty</th>
              <th className="text-right font-medium py-2 px-2" style={{ color: accent }}>Unit</th>
              <th className="text-right font-medium py-2 px-2" style={{ color: accent }}>Disc %</th>
              <th className="text-right font-medium py-2 pl-2" style={{ color: accent }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedItems.map((item) => (
              <tr key={item.key} className="border-b border-gray-100">
                <td className="py-2 pr-2 align-top">
                  {item.lineType === "SERVICE" ? (
                    <p className="font-medium italic">{item.productName}</p>
                  ) : (
                    <>
                      {item.model && (
                        <p className="font-medium">{item.model}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {item.model ? `(${item.productName})` : item.productName}
                      </p>
                    </>
                  )}
                </td>
                <td className="py-2 px-2 align-top">
                  {item.serials.length > 0 ? (
                    <p className="text-xs font-mono text-gray-600">{item.serials.join(", ")}</p>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right tabular-nums align-top">{item.totalQty}</td>
                <td className="py-2 px-2 text-right tabular-nums align-top">{formatBDT(item.unitPrice)}</td>
                <td className="py-2 px-2 text-right tabular-nums align-top">{item.discount || 0}%</td>
                <td className="py-2 pl-2 text-right tabular-nums font-medium align-top">{formatBDT(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} className="text-right py-2 text-gray-600">Subtotal</td><td className="text-right tabular-nums py-2">{formatBDT(sale.total + sale.discount)}</td></tr>
            {sale.discount > 0 && <tr><td colSpan={5} className="text-right py-2 text-gray-600">Discount</td><td className="text-right tabular-nums py-2">-{formatBDT(sale.discount)}</td></tr>}
            <tr>
              <td colSpan={5} className="text-right py-2 font-bold border-t" style={{ color: accent }}>Total</td>
              <td className="text-right tabular-nums py-2 font-bold" style={{ color: accent }}>{formatBDT(sale.total)}</td>
            </tr>
            <tr><td colSpan={5} className="text-right py-2 text-gray-600">Paid</td><td className="text-right tabular-nums py-2">{formatBDT(sale.paid)}</td></tr>
            {sale.due > 0 && <tr><td colSpan={5} className="text-right py-2 font-bold text-amber-700">Due</td><td className="text-right tabular-nums py-2 font-bold text-amber-700">{formatBDT(sale.due)}</td></tr>}
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {sale.notes && (
        <div className="px-4 pb-4 pt-2 border-t">
          <p className="text-xs text-gray-500 font-medium">Notes</p>
          <p className="text-sm text-gray-700">{sale.notes}</p>
        </div>
      )}

      {/* Pagination indicator */}
      {invoicePages.length > 1 && (
        <div className="px-4 py-2 text-center text-xs text-gray-400 border-t">
          Page 1 of {invoicePages.length} — {groupedItems.length} items total
        </div>
      )}

      {/* Custom footer image OR default footer */}
      {footerImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(footerImg) ?? ""} alt="Invoice footer" className="w-full h-16 object-cover" />
      ) : (
        <div className="h-12 flex items-center justify-center border-t bg-gray-50">
          <p className="text-xs text-gray-400">Thank you for your business!</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PRINT RENDERER (inline styles)
//  Used by /cctv/print/sales/<id> — bare page, no app shell.
//  Inline styles have highest CSS specificity — survive @media print
//  overrides, dark-mode flips, browser default print styles.
// ════════════════════════════════════════════════════════════════════
function PrintInvoice({
  sale,
  groupedItems,
  invoicePages,
  accent,
  headerImg,
  footerImg,
  businessName,
  businessLogo,
  businessPhone,
  businessAddress,
}: RendererProps) {
  // ── Inline styles for the print-critical container ──────────────────
  // Why inline styles instead of Tailwind classes?
  //   - Tailwind's `print:` variant generates @media print rules, but they
  //     can be overridden by other CSS or by browser default print styles.
  //   - Inline styles are guaranteed to apply (highest specificity).
  //   - The previous version used `min-h-screen` + `overflow-hidden` which
  //     interacted badly with @media print (100vh in print is undefined,
  //     overflow-hidden clipped content). Inline styles avoid those issues.
  //   - We also force colors via inline style so dark mode / browser color
  //     overrides can't make the text white-on-white.
  const invoiceBoxStyle: React.CSSProperties = {
    maxWidth: "800px",
    margin: "0 auto",
    border: `1px solid #e5e7eb`,
    borderRadius: "8px",
    overflow: "hidden",
    background: "#ffffff",
    color: "#000000",
  };

  return (
    <div style={invoiceBoxStyle}>
      {/* Header */}
      {headerImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(headerImg) ?? ""} alt="Invoice header" style={{ width: "100%", height: "96px", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${accent}`, backgroundColor: `${accent}08` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {businessLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(businessLogo) ?? ""} alt="Logo" style={{ height: "40px", width: "40px", borderRadius: "4px", objectFit: "contain" }} />
            )}
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: accent }}>{businessName}</h2>
              {businessPhone && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{businessPhone}</p>}
              {businessAddress && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{businessAddress}</p>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Invoice</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>{sale.invoiceNo}</p>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{formatDateTime(sale.date)}</p>
          </div>
        </div>
      )}

      {/* Bill to + invoice no (if header image set) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "12px 16px", fontSize: "14px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Bill to</p>
          <p style={{ fontWeight: 500, margin: 0 }}>{sale.customer?.name ?? "Walk-in customer"}</p>
          {sale.customer?.phone && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{sale.customer.phone}</p>}
          {sale.customer?.address && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{sale.customer.address}</p>}
        </div>
        <div style={{ textAlign: "right" }}>
          {headerImg && (
            <>
              <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>{sale.invoiceNo}</p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{formatDateTime(sale.date)}</p>
            </>
          )}
          {sale.salesman && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Salesman: {sale.salesman.name}</p>}
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Payment: {sale.mode}</p>
        </div>
      </div>

      {/* Items table */}
      <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th style={{ textAlign: "left", fontWeight: 500, padding: "8px 8px 8px 0", color: accent }}>Item</th>
              <th style={{ textAlign: "left", fontWeight: 500, padding: "8px", color: accent }}>Serials</th>
              <th style={{ textAlign: "right", fontWeight: 500, padding: "8px", color: accent }}>Qty</th>
              <th style={{ textAlign: "right", fontWeight: 500, padding: "8px", color: accent }}>Unit</th>
              <th style={{ textAlign: "right", fontWeight: 500, padding: "8px", color: accent }}>Disc %</th>
              <th style={{ textAlign: "right", fontWeight: 500, padding: "8px 0 8px 8px", color: accent }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedItems.map((item) => (
              <tr key={item.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 8px 8px 0", verticalAlign: "top" }}>
                  {item.lineType === "SERVICE" ? (
                    <p style={{ fontWeight: 500, fontStyle: "italic", margin: 0 }}>{item.productName}</p>
                  ) : (
                    <>
                      {item.model && <p style={{ fontWeight: 500, margin: 0 }}>{item.model}</p>}
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                        {item.model ? `(${item.productName})` : item.productName}
                      </p>
                    </>
                  )}
                </td>
                <td style={{ padding: "8px", verticalAlign: "top" }}>
                  {item.serials.length > 0 ? (
                    <p style={{ fontSize: "12px", fontFamily: "monospace", color: "#4b5563", margin: 0 }}>{item.serials.join(", ")}</p>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>{item.totalQty}</td>
                <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>{formatBDT(item.unitPrice)}</td>
                <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>{item.discount || 0}%</td>
                <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, verticalAlign: "top" }}>{formatBDT(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", color: "#4b5563" }}>Subtotal</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{formatBDT(sale.total + sale.discount)}</td></tr>
            {sale.discount > 0 && <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", color: "#4b5563" }}>Discount</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>-{formatBDT(sale.discount)}</td></tr>}
            <tr style={{ borderTop: `2px solid ${accent}` }}>
              <td colSpan={5} style={{ textAlign: "right", padding: "8px", fontWeight: 700, color: accent }}>Total</td>
              <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: accent }}>{formatBDT(sale.total)}</td>
            </tr>
            <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", color: "#4b5563" }}>Paid</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{formatBDT(sale.paid)}</td></tr>
            {sale.due > 0 && <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", fontWeight: 700, color: "#b45309" }}>Due</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#b45309" }}>{formatBDT(sale.due)}</td></tr>}
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {sale.notes && (
        <div style={{ padding: "8px 16px 16px", borderTop: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 500, margin: 0 }}>Notes</p>
          <p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0" }}>{sale.notes}</p>
        </div>
      )}

      {/* Footer */}
      {footerImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl(footerImg) ?? ""} alt="Invoice footer" style={{ width: "100%", height: "64px", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ height: "48px", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
          <p style={{ fontSize: "12px", color: "#9ca3af" }}>Thank you for your business!</p>
        </div>
      )}
    </div>
  );
}
