"use client";

/**
 * /print/sales/[id] — bare invoice print page.
 *
 * LIVES OUTSIDE THE (app) ROUTE GROUP so it does NOT inherit the AppShell
 * (sidebar, mobile top bar, mobile bottom nav, footer). The page renders
 * ONLY the invoice and auto-triggers window.print() on mount.
 *
 * Why outside (app)?
 *   - The previous version lived at /sales/[id}/print inside (app), so it was
 *     wrapped by AppShell. Even with body:has([data-bare-print="true"]) CSS
 *     rules hiding the chrome, the print preview was still showing a blank
 *     white page — most likely because the wrapping <main> + <div> from
 *     AppShell + their Tailwind utility classes (min-h-screen, overflow-hidden,
 *     max-w-7xl, py-6, etc.) were interacting badly with @media print rules.
 *   - Moving the route outside (app) eliminates the AppShell wrapper entirely,
 *     so the only thing on the page IS the invoice. No CSS hacks needed.
 *
 * Auth: still required. The middleware (proxy.ts) protects all non-public
 * routes, so the user must be logged in to access this page. The session
 * cookie is shared with the parent tab that opened this one, so it works.
 *
 * The invoice markup duplicates /sales/[id}/page.tsx. If the invoice layout
 * changes, update both files.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { assetUrl } from "@/lib/app-path";

export default function PrintInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [printed, setPrinted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sale", id, "print"],
    queryFn: async () => (await (await fetch(`/cctv/api/sales/${id}`)).json()).sale,
    enabled: !!id,
  });

  const { data: profile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const r = await fetch("/cctv/api/business-profile");
      if (!r.ok) return null;
      return (await r.json()).profile;
    },
  });

  // Auto-print once the data has loaded. We wait for both the sale + profile
  // (profile is optional — if it fails, we still print with defaults).
  useEffect(() => {
    if (isLoading || !data || printed) return;
    // Small delay so the DOM paints before print dialog opens.
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // Print blocked — user can use Ctrl+P manually.
      }
      setPrinted(true);
    }, 400);
    return () => clearTimeout(t);
  }, [isLoading, data, printed]);

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>Sale not found.</p>
      </div>
    );
  }

  const sale: any = data;
  const accent = profile?.invoiceAccentColor ?? "#1A73E8";
  const headerImg = profile?.invoiceHeaderImage ?? null;
  const footerImg = profile?.invoiceFooterImage ?? null;
  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;
  const businessPhone = profile?.phone ?? null;
  const businessAddress = profile?.address ?? null;

  // Group items by product (same logic as /sales/[id}/page.tsx).
  const items = (sale.items ?? []) as any[];
  const groups = new Map<string, any>();
  for (const it of items) {
    if (it.lineType === "SERVICE") {
      groups.set(`svc-${it.id}`, {
        key: `svc-${it.id}`,
        productName: it.description ?? "Service",
        model: null,
        lineType: "SERVICE",
        serials: [],
        totalQty: it.qty,
        unitPrice: it.unitPrice,
        discount: it.discount,
        lineTotal: it.lineTotal,
      });
      continue;
    }
    if (!it.inventoryUnitId) {
      const key = `ns-${it.productId ?? it.id}`;
      const ex = groups.get(key);
      if (ex) {
        ex.totalQty += it.qty;
        ex.lineTotal += it.lineTotal;
      } else {
        groups.set(key, {
          key,
          productName: it.product?.name ?? it.description ?? "Product",
          model: it.product?.model ?? null,
          lineType: "PRODUCT",
          serials: [],
          totalQty: it.qty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          lineTotal: it.lineTotal,
        });
      }
      continue;
    }
    const key = `s-${it.productId ?? it.id}`;
    const ex = groups.get(key);
    if (ex) {
      if (it.inventoryUnit?.serialNo) ex.serials.push(it.inventoryUnit.serialNo);
      ex.totalQty += 1;
      ex.lineTotal += it.lineTotal;
    } else {
      groups.set(key, {
        key,
        productName: it.product?.name ?? it.description ?? "Product",
        model: it.product?.model ?? null,
        lineType: "PRODUCT",
        serials: it.inventoryUnit?.serialNo ? [it.inventoryUnit.serialNo] : [],
        totalQty: 1,
        unitPrice: it.unitPrice,
        discount: it.discount,
        lineTotal: it.lineTotal,
      });
    }
  }
  const groupedItems = Array.from(groups.values());

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
  const pageStyle: React.CSSProperties = {
    background: "#ffffff",
    color: "#000000",
    padding: "1.5rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    // Critical for print: ensure colors print even when browser has
    // "Background graphics" off.
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

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
    <div style={pageStyle}>
      {/* Hint shown on screen (not in print) telling the user the print
          dialog should have opened. Useful if popup was blocked. */}
      <p
        style={{
          marginBottom: "8px",
          fontSize: "12px",
          color: "#6b7280",
          textAlign: "center",
        }}
        className="print:hidden"
      >
        Invoice <strong>{sale.invoiceNo}</strong> — print dialog should open
        automatically. If not, press <kbd style={{ padding: "2px 4px", border: "1px solid #ccc", borderRadius: "4px" }}>Ctrl</kbd>
        +<kbd style={{ padding: "2px 4px", border: "1px solid #ccc", borderRadius: "4px" }}>P</kbd>.
      </p>

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
    </div>
  );
}
