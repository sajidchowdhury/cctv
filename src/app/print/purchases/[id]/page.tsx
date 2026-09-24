"use client";

/**
 * /print/purchases/[id] — bare purchase invoice print page.
 *
 * Same pattern as /print/sales/[id]:
 * - Lives outside the (app) route group (no AppShell)
 * - Fetches the purchase + business profile
 * - Auto-triggers window.print() on mount (400ms delay for paint)
 * - Uses inline styles for print reliability
 *
 * Shows: business header, supplier info, items table (SL, Product, Model,
 * Qty, Unit, Warranty, Serials, Total), totals (subtotal, discount, total,
 * paid, due), footer.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatBDT, formatDateTime } from "@/lib/format";
import { assetUrl } from "@/lib/app-path";

export default function PrintPurchasePage() {
  const { id } = useParams<{ id: string }>();
  const [printed, setPrinted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase", id, "print"],
    queryFn: async () => (await (await fetch(`/cctv/api/purchases/${id}`)).json()).purchase,
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

  useEffect(() => {
    if (isLoading || !data || printed) return;
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
        <p>Purchase not found.</p>
      </div>
    );
  }

  const purchase: any = data;
  const accent = profile?.invoiceAccentColor ?? "#1A73E8";
  const headerImg = profile?.invoiceHeaderImage ?? null;
  const footerImg = profile?.invoiceFooterImage ?? null;
  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;
  const businessPhone = profile?.phone ?? null;
  const businessAddress = profile?.address ?? null;

  // Group items by product (same as invoice grouping — serials collected per product).
  const items = (purchase.items ?? []) as any[];
  const groups = new Map<string, any>();
  for (const it of items) {
    const key = `p-${it.productId ?? it.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalQty += it.qty;
      existing.lineTotal += it.lineTotal;
      if (it.serials && it.serials.length > 0) {
        existing.serials.push(...it.serials);
      }
    } else {
      groups.set(key, {
        key,
        productName: it.productName ?? "Product",
        productModel: it.productModel ?? null,
        totalQty: it.qty,
        unitPrice: it.unitPrice,
        warrantyMonths: it.warrantyMonths,
        lineTotal: it.lineTotal,
        serials: it.serials ?? [],
      });
    }
  }
  const groupedItems = Array.from(groups.values());

  const pageStyle: React.CSSProperties = {
    background: "#ffffff",
    color: "#000000",
    padding: "1.5rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
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
      <p
        style={{ marginBottom: "8px", fontSize: "12px", color: "#6b7280", textAlign: "center" }}
        className="print:hidden"
      >
        Purchase invoice <strong>{purchase.invoiceNo}</strong> — print dialog should open
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
              <p style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Purchase</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>{purchase.invoiceNo}</p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{formatDateTime(purchase.date)}</p>
            </div>
          </div>
        )}

        {/* Supplier info + invoice no */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "12px 16px", fontSize: "14px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Supplier</p>
            <p style={{ fontWeight: 500, margin: 0 }}>{purchase.supplierName ?? "Walk-in"}</p>
            {purchase.supplier?.phone && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{purchase.supplier.phone}</p>}
            {purchase.supplier?.company && <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{purchase.supplier.company}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            {headerImg && (
              <>
                <p style={{ fontSize: "14px", fontWeight: 700, color: accent, margin: 0 }}>{purchase.invoiceNo}</p>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{formatDateTime(purchase.date)}</p>
              </>
            )}
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Payment: {purchase.mode}</p>
          </div>
        </div>

        {/* Items table */}
        <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${accent}` }}>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "8px 4px 8px 0", color: accent, width: "24px" }}>SL</th>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "8px", color: accent }}>Product Description</th>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "8px", color: accent }}>Warranty</th>
                <th style={{ textAlign: "right", fontWeight: 500, padding: "8px", color: accent }}>Qty</th>
                <th style={{ textAlign: "right", fontWeight: 500, padding: "8px", color: accent }}>Unit Price</th>
                <th style={{ textAlign: "right", fontWeight: 500, padding: "8px 0 8px 8px", color: accent }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((item, idx) => (
                <tr key={item.key} style={{ borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
                  <td style={{ padding: "8px 4px 8px 0" }}>{idx + 1}</td>
                  <td style={{ padding: "8px" }}>
                    <p style={{ fontWeight: 500, margin: 0 }}>{item.productName}</p>
                    {item.productModel && (
                      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>{item.productModel}</p>
                    )}
                    {item.serials.length > 0 && (
                      <div style={{ marginTop: "2px" }}>
                        {item.serials.slice(0, 5).join(", ")}
                        {item.serials.length > 5 && `, +${item.serials.length - 5} more`}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px", fontSize: "12px" }}>
                    {item.warrantyMonths > 0
                      ? item.warrantyMonths === 12 ? "1 YEAR" : item.warrantyMonths === 24 ? "2 YEARS" : item.warrantyMonths === 36 ? "3 YEARS" : `${item.warrantyMonths} MONTHS`
                      : "—"}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.totalQty}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatBDT(item.unitPrice)}</td>
                  <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{formatBDT(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", color: "#4b5563" }}>Subtotal</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{formatBDT(purchase.total)}</td></tr>
              <tr style={{ borderTop: `2px solid ${accent}` }}>
                <td colSpan={5} style={{ textAlign: "right", padding: "8px", fontWeight: 700, color: accent }}>Total</td>
                <td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: accent }}>{formatBDT(purchase.total)}</td>
              </tr>
              <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", color: "#4b5563" }}>Paid</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums" }}>{formatBDT(purchase.paid)}</td></tr>
              {purchase.due > 0 && <tr><td colSpan={5} style={{ textAlign: "right", padding: "8px", fontWeight: 700, color: "#b45309" }}>Due</td><td style={{ textAlign: "right", padding: "8px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#b45309" }}>{formatBDT(purchase.due)}</td></tr>}
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {purchase.notes && (
          <div style={{ padding: "8px 16px 16px", borderTop: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 500, margin: 0 }}>Notes</p>
            <p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0" }}>{purchase.notes}</p>
          </div>
        )}

        {/* Footer */}
        {footerImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(footerImg) ?? ""} alt="Invoice footer" style={{ width: "100%", height: "64px", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ height: "48px", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
            <p style={{ fontSize: "12px", color: "#9ca3af" }}>Purchase invoice — keep for your records.</p>
          </div>
        )}
      </div>
    </div>
  );
}
