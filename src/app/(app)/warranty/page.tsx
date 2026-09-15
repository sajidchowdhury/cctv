"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2,
  ShoppingCart, PackagePlus, Wrench, Clock, Phone, User,
} from "lucide-react";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

type Unit = {
  id: string;
  serialNo: string;
  status: string;
  productId: string;
  productName: string;
  productModel: string | null;
  productSku: string;
  purchaseId: string | null;
  purchaseInvoice: string | null;
  purchaseDate: string | null;
  purchaseSupplier: string | null;
  purchasePrice: number | null;
  warrantyMonths: number | null;
  saleId: string | null;
  saleInvoice: string | null;
  saleDate: string | null;
  saleCustomer: string | null;
  saleCustomerPhone: string | null;
  salePrice: number | null;
  warrantyEnd: string | null;
  warrantyStatus: string;
  daysLeft: number | null;
  rmaTickets: { rmaNo: string; stage: string; dateOpened: string; faultReason: string; closedAt: string | null }[];
  serviceTickets: { issue: string; status: string; charge: number; createdAt: string }[];
};

export default function WarrantyPage() {
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["warranty-lookup", activeQuery],
    queryFn: async () => {
      const r = await fetch(`/cctv/api/warranty/lookup?q=${encodeURIComponent(activeQuery)}`);
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.error ?? `Search failed (HTTP ${r.status})`);
      }
      return data;
    },
    enabled: activeQuery.length > 0,
  });

  const units: Unit[] = data?.units ?? [];

  function onSearch() {
    setActiveQuery(search.trim());
  }

  const warrantyBadge = (status: string, daysLeft: number | null) => {
    if (status === "not_applicable") {
      return <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><ShieldX className="h-3 w-3 mr-1" /> Not applicable</Badge>;
    }
    if (status === "active") {
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><ShieldCheck className="h-3 w-3 mr-1" /> In warranty{daysLeft !== null && daysLeft <= 30 ? ` · ${daysLeft}d left` : ""}</Badge>;
    }
    return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"><ShieldAlert className="h-3 w-3 mr-1" /> Expired{daysLeft !== null ? ` · ${Math.abs(daysLeft)}d ago` : ""}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warranty & Product History"
        description="Search by serial number or product name to see full history — purchase, sale, warranty, RMA."
      />

      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2">
            <SearchScanInput
              value={search}
              onChange={setSearch}
              placeholder="Search serial / product name / model / SKU…"
              className="flex-1"
              onEnter={onSearch}
            />
            <Button onClick={onSearch} disabled={!search.trim()}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {!activeQuery ? (
        <EmptyState
          icon={ShieldCheck}
          title="Search for a product"
          description="Enter a serial number or product name to see its full history: purchase, sale, warranty, RMA."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <EmptyState
          icon={ShieldAlert}
          title="Search failed"
          description={(error as Error).message ?? "Could not complete the search. Please try again."}
        />
      ) : units.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No results found"
          description={`No units found for "${activeQuery}". Try a different search.`}
        />
      ) : (
        <div className="space-y-4">
          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {units.length} {units.length === 1 ? "result" : "results"} for &ldquo;{activeQuery}&rdquo;
            </p>
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveQuery(""); }}>
              Clear search
            </Button>
          </div>
          {units.map((u) => (
            <Card key={u.id}>
              <CardContent className="py-4 space-y-4">
                {/* Header: product + serial + warranty badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{u.productName}</p>
                    <p className="text-xs text-muted-foreground">{u.productModel ?? "—"} · {u.productSku}</p>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">{u.serialNo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {warrantyBadge(u.warrantyStatus, u.daysLeft)}
                    <Badge variant="outline" className="mt-1 ml-auto block w-fit text-xs">
                      {u.status === "SOLD" ? "Sold" : u.status === "IN_STOCK" ? "In stock" : u.status === "IN_RMA" ? "In RMA" : u.status === "DELIVERED" ? "Delivered" : u.status}
                    </Badge>
                  </div>
                </div>

                {/* Timeline sections */}
                <div className="space-y-3 border-t pt-3">
                  {/* Purchase */}
                  <div className="flex items-start gap-2">
                    <PackagePlus className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm space-y-0.5">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Purchase</p>
                      {u.purchaseInvoice ? (
                        <>
                          <p>Invoice: <span className="font-medium">{u.purchaseInvoice}</span> · {u.purchaseDate ? formatDate(u.purchaseDate) : "—"}</p>
                          {u.purchaseSupplier && <p className="text-muted-foreground">Supplier: {u.purchaseSupplier}</p>}
                          {u.purchasePrice !== null && <p className="text-muted-foreground">Purchase price: {formatBDT(u.purchasePrice)}</p>}
                          {u.warrantyMonths !== null && u.warrantyMonths > 0 && <p className="text-muted-foreground">Warranty: {u.warrantyMonths} months</p>}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Purchase data not found</p>
                      )}
                    </div>
                  </div>

                  {/* Sale */}
                  <div className="flex items-start gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm space-y-0.5">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Sale</p>
                      {u.saleInvoice ? (
                        <>
                          <p>Invoice: <span className="font-medium">{u.saleInvoice}</span> · {u.saleDate ? formatDate(u.saleDate) : "—"}</p>
                          {u.saleCustomer && (
                            <p className="text-muted-foreground">
                              Customer: {u.saleCustomer}
                              {u.saleCustomerPhone && <span> · <Phone className="inline h-3 w-3" /> {u.saleCustomerPhone}</span>}
                            </p>
                          )}
                          {u.salePrice !== null && <p className="text-muted-foreground">Sale price: {formatBDT(u.salePrice)}</p>}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Not yet sold — unit is in stock</p>
                      )}
                    </div>
                  </div>

                  {/* Warranty */}
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm space-y-0.5">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Warranty</p>
                      {u.warrantyStatus === "not_applicable" ? (
                        <p className="text-muted-foreground">Not applicable — no warranty set on this unit</p>
                      ) : (
                        <>
                          <p>Status: {u.warrantyStatus === "active" ? "Active" : "Expired"}</p>
                          {u.warrantyEnd && <p className="text-muted-foreground">Valid until: {formatDate(u.warrantyEnd)}</p>}
                          {u.daysLeft !== null && u.warrantyStatus === "active" && (
                            <p className="text-muted-foreground">Days remaining: {u.daysLeft}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* RMA */}
                  <div className="flex items-start gap-2">
                    <Wrench className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm space-y-0.5">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">RMA Records</p>
                      {u.rmaTickets.length > 0 ? (
                        u.rmaTickets.map((r, i) => (
                          <div key={i} className="border-l-2 border-violet-200 dark:border-violet-800 pl-2">
                            <p><span className="font-medium">{r.rmaNo}</span> · {r.stage.replace(/_/g, " ")} · {formatDate(r.dateOpened)}</p>
                            <p className="text-muted-foreground">Fault: {r.faultReason}</p>
                            {r.closedAt && <p className="text-emerald-600 text-xs">Closed: {formatDate(r.closedAt)}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No RMA records</p>
                      )}
                    </div>
                  </div>

                  {/* Service Tickets */}
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm space-y-0.5">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Service Tickets</p>
                      {u.serviceTickets.length > 0 ? (
                        u.serviceTickets.map((s, i) => (
                          <div key={i}>
                            <p>{s.issue} · <Badge variant="outline" className="text-xs">{s.status}</Badge></p>
                            <p className="text-muted-foreground">Charge: {formatBDT(s.charge)} · {formatDate(s.createdAt)}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">No service tickets</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions — navigation links to related records */}
                {(u.saleId || u.productId || u.purchaseId) && (
                  <div className="flex gap-2 pt-2 border-t flex-wrap">
                    {u.productId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/products/${u.productId}`}><PackagePlus className="mr-1 h-3 w-3" /> View product</Link>
                      </Button>
                    )}
                    {u.saleId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/sales/${u.saleId}`}>View sale invoice →</Link>
                      </Button>
                    )}
                    {u.purchaseId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/purchases/${u.purchaseId}`}>View purchase →</Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
