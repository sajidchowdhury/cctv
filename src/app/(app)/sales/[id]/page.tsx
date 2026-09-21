"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer, Pause, Check, Link2, ShieldCheck, MessageSquare, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { assetUrl, appPath } from "@/lib/app-path";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [smsBusy, setSmsBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: async () => (await (await fetch(`/cctv/api/sales/${id}`)).json()).sale,
    enabled: !!id,
  });

  // Fetch business profile for invoice customization (header/footer images, accent color, productsPerPage).
  const { data: profile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const r = await fetch("/cctv/api/business-profile");
      if (!r.ok) return null;
      return (await r.json()).profile;
    },
  });

  // ── Group items by product for the invoice display ───────────────
  // Format: MODEL NAME (PRODUCT NAME) \n SERIAL 1, SERIAL 2, ...
  // Non-serialised + service items show as-is (one row each).
  // Must be called BEFORE early returns (React hooks rules).
  const groupedItems = useMemo(() => {
    const items = (data as any)?.items ?? [];
    const groups = new Map<string, {
      key: string;
      productId: string | null;
      productName: string;
      model: string | null;
      isSerialised: boolean;
      lineType: string;
      description: string;
      serials: string[];
      totalQty: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
    }>();

    for (const it of items) {
      // Service lines: each is its own group.
      if (it.lineType === "SERVICE") {
        const key = `svc-${it.id}`;
        groups.set(key, {
          key,
          productId: null,
          productName: it.description ?? "Service",
          model: null,
          isSerialised: false,
          lineType: "SERVICE",
          description: it.description ?? "",
          serials: [],
          totalQty: it.qty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          lineTotal: it.lineTotal,
        });
        continue;
      }

      // Non-serialised products: group by productId (accumulate qty).
      if (!it.inventoryUnitId) {
        const key = `ns-${it.productId ?? it.id}`;
        const existing = groups.get(key);
        if (existing) {
          existing.totalQty += it.qty;
          existing.lineTotal += it.lineTotal;
        } else {
          groups.set(key, {
            key,
            productId: it.productId ?? null,
            productName: it.product?.name ?? it.description ?? "Product",
            model: it.product?.model ?? null,
            isSerialised: false,
            lineType: "PRODUCT",
            description: it.description ?? "",
            serials: [],
            totalQty: it.qty,
            unitPrice: it.unitPrice,
            discount: it.discount,
            lineTotal: it.lineTotal,
          });
        }
        continue;
      }

      // Serialised products: group by productId, collect serials.
      const key = `s-${it.productId ?? it.id}`;
      const existing = groups.get(key);
      if (existing) {
        if (it.inventoryUnit?.serialNo) {
          existing.serials.push(it.inventoryUnit.serialNo);
        }
        existing.totalQty += 1; // each serialised SaleItem is qty=1
        existing.lineTotal += it.lineTotal;
      } else {
        groups.set(key, {
          key,
          productId: it.productId ?? null,
          productName: it.product?.name ?? it.description ?? "Product",
          model: it.product?.model ?? null,
          isSerialised: true,
          lineType: "PRODUCT",
          description: it.description ?? "",
          serials: it.inventoryUnit?.serialNo ? [it.inventoryUnit.serialNo] : [],
          totalQty: 1,
          unitPrice: it.unitPrice,
          discount: it.discount,
          lineTotal: it.lineTotal,
        });
      }
    }

    return Array.from(groups.values());
  }, [data]);

  // Paginate the grouped items for print (productsPerPage per page).
  const productsPerPage = profile?.invoiceProductsPerPage ?? 10;
  const invoicePages = useMemo(() => {
    if (groupedItems.length <= productsPerPage) return [groupedItems];
    const pages: typeof groupedItems[] = [];
    for (let i = 0; i < groupedItems.length; i += productsPerPage) {
      pages.push(groupedItems.slice(i, i + productsPerPage));
    }
    return pages;
  }, [groupedItems, productsPerPage]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">Sale not found.</p>;

  const sale: any = data;

  // ── Invoice customization settings ──────────────────────────────
  const accent = profile?.invoiceAccentColor ?? "#1A73E8";
  const headerImg = profile?.invoiceHeaderImage ?? null;
  const footerImg = profile?.invoiceFooterImage ?? null;
  const businessName = profile?.name ?? "CCTV Inventory";
  const businessLogo = profile?.businessLogo ?? null;
  const businessPhone = profile?.phone ?? null;
  const businessAddress = profile?.address ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sale.invoiceNo}
        description={`${formatDate(sale.date)} · ${sale.customer?.name ?? "Walk-in"}`}
        action={
          <div className="flex gap-2 flex-wrap">
            {sale.isHeld && <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Pause className="h-3 w-3 mr-1" /> Held</Badge>}
            {sale.isHeld && (
              <Button asChild size="sm">
                <Link href={`/sales/new?resume=${id}`}><RotateCcw className="mr-2 h-4 w-4" /> Resume</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/sales"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={appPath(`/print/sales/${id}`)} target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" /> Print
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/cctv/api/sales/${id}/warranty-card.pdf`} target="_blank" rel="noopener noreferrer">
                <ShieldCheck className="mr-2 h-4 w-4" /> Warranty card
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={smsBusy}
              onClick={async () => {
                setSmsBusy(true);
                try {
                  const res = await fetch(`/cctv/api/sales/${id}/send-warranty-sms`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast({ title: "Failed", description: data.error ?? "SMS not sent.", variant: "destructive" });
                  } else {
                    toast({ title: "SMS sent", description: data.message });
                  }
                } finally {
                  setSmsBusy(false);
                }
              }}
            >
              {smsBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Warranty SMS
            </Button>
            {!sale.isHeld && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/sales/new?resume=${id}&edit=1`}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-destructive" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
              }
              title="Delete this sale?"
              description="This will restore all sold units to IN_STOCK and reverse the customer's balance. The sale is soft-deleted (data preserved). This action cannot be undone."
              destructive
              confirmLabel="Delete sale"
              onConfirm={async () => {
                setDeleting(true);
                try {
                  const res = await fetch(`/cctv/api/sales/${id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast({ title: "Failed", description: data.error ?? "Delete failed.", variant: "destructive" });
                  } else {
                    toast({ title: "Sale deleted", description: data.message });
                    qc.invalidateQueries({ queryKey: ["sales"] });
                    router.push("/sales");
                  }
                } finally {
                  setDeleting(false);
                }
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.total)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.paid)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Due</p><p className={`text-xl font-bold tabular-nums ${sale.due > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(sale.due)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Mode</p><Badge variant="secondary">{sale.mode}</Badge></CardContent></Card>
      </div>

      {sale.quotationId && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-violet-500" />
            <span className="text-muted-foreground">Converted from quotation.</span>
            <Link href={`/quotations/${sale.quotationId}`} className="font-medium text-violet-600 dark:text-violet-400 hover:underline">View quote →</Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
