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
 * Invoice markup is delegated to <InvoiceDocument printMode /> — the shared
 * component extracted in Phase 1. Phase 2 changes the table structure
 * (warranty column + new item layout) in that single component, and both
 * the on-screen + print pages get the change automatically.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InvoiceDocument } from "@/components/invoice/invoice-document";

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

  // ── Inline styles for the page wrapper ──────────────────────────────
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
        Invoice <strong>{(data as any).invoiceNo}</strong> — print dialog should open
        automatically. If not, press <kbd style={{ padding: "2px 4px", border: "1px solid #ccc", borderRadius: "4px" }}>Ctrl</kbd>
        +<kbd style={{ padding: "2px 4px", border: "1px solid #ccc", borderRadius: "4px" }}>P</kbd>.
      </p>

      {/* The actual invoice — delegated to the shared component. */}
      <InvoiceDocument sale={data} profile={profile} printMode />
    </div>
  );
}
