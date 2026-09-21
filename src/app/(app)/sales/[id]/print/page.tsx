"use client";

/**
 * /sales/[id]/print — bare invoice print page.
 *
 * Renders ONLY the invoice (no AppShell, no sidebar, no buttons) and
 * auto-triggers window.print() on mount. This is the page opened by:
 *   - the Print button on /sales/[id]
 *   - the auto-open in new tab after Save Sale on /sales/new
 *
 * Why a dedicated route (instead of CSS @media print on /sales/[id])?
 *   1. The user reported the print view was a blank white page — most likely
 *      because the existing print CSS was hiding too much (sidebar, nav, etc.)
 *      but the Card wrappers + stat cards + page header were still rendered
 *      and overlapped each other in print layout.
 *   2. The user explicitly wants a "real invoice" to open in a new tab when
 *      Save Sale is clicked — not the full /sales/[id} detail page with all
 *      its action buttons + chrome.
 *
 * This page lives under the (app) route group so it inherits the AppShell
 * layout (sidebar + mobile nav). We override that with a `print:bg-white`
 * + a CSS rule that hides the shell. But the simpler trick is: this page
 * renders an absolutely-positioned white overlay covering the viewport,
 * so even with the shell present, only the invoice shows.
 *
 * The invoice markup is duplicated from /sales/[id]/page.tsx to keep this
 * route self-contained (no shared component extraction needed yet). If the
 * invoice layout changes, update both files.
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
    }, 300);
    return () => clearTimeout(t);
  }, [isLoading, data, printed]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return <p className="text-muted-foreground">Sale not found.</p>;
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

  return (
    <div data-bare-print="true" className="min-h-screen bg-white text-black p-4 print:p-0">
      {/* Hint shown on screen (not in print) telling the user the print
          dialog should have opened. Useful if popup was blocked. */}
      <p className="mb-2 text-xs text-gray-500 print:hidden">
        Invoice <strong>{sale.invoiceNo}</strong> — print dialog should open
        automatically. If not, press <kbd className="px-1 py-0.5 border rounded">Ctrl</kbd>
        +<kbd className="px-1 py-0.5 border rounded">P</kbd>.
      </p>

      <div className="rounded-lg border overflow-hidden bg-white text-black max-w-3xl mx-auto print:border-0 print:max-w-none print:rounded-none">
        {/* Header */}
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

        {/* Bill to + invoice no (if header image set) */}
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

        {/* Items table */}
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
                        {item.model && <p className="font-medium">{item.model}</p>}
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

        {/* Footer */}
        {footerImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(footerImg) ?? ""} alt="Invoice footer" className="w-full h-16 object-cover" />
        ) : (
          <div className="h-12 flex items-center justify-center border-t bg-gray-50">
            <p className="text-xs text-gray-400">Thank you for your business!</p>
          </div>
        )}
      </div>
    </div>
  );
}
