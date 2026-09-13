"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

type Unit = {
  id: string;
  serialNo: string;
  status: string;
  warrantyEnd: string | null;
  inWarranty: boolean;
  productName: string;
  productModel: string | null;
  productSku: string;
  saleInvoice: string | null;
  saleDate: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

export default function WarrantyPage() {
  const [serial, setSerial] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warranty-lookup", activeQuery],
    queryFn: async () => {
      const r = await fetch(`/api/warranty/lookup?serial=${encodeURIComponent(activeQuery)}`);
      return await r.json();
    },
    enabled: activeQuery.length > 0,
  });

  const units: Unit[] = data?.units ?? [];

  function onSearch() {
    setActiveQuery(serial.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warranty lookup"
        description="Look up a sold unit by serial number to check warranty status."
      />

      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2">
            <SearchScanInput
              value={serial}
              onChange={setSerial}
              placeholder="Scan or type serial number…"
              className="flex-1"
              onEnter={onSearch}
            />
            <Button onClick={onSearch} disabled={!serial.trim()}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {!activeQuery ? (
        <EmptyState
          icon={ShieldCheck}
          title="Search for a warranty"
          description="Enter a serial number to look up the warranty status of a sold unit."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : units.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No matching units"
          description={`No sold unit found for serial "${activeQuery}".`}
        />
      ) : (
        <div className="space-y-3">
          {units.map((u) => (
            <Card key={u.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{u.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.productModel ?? "—"} · {u.productSku}
                    </p>
                  </div>
                  {u.inWarranty ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3 mr-1" /> In warranty
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Expired
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Serial</p>
                    <p className="font-mono text-xs">{u.serialNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Warranty until</p>
                    <p className="font-medium">{u.warrantyEnd ? formatDate(u.warrantyEnd) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice</p>
                    <p className="font-medium">{u.saleInvoice ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sale date</p>
                    <p className="font-medium">{u.saleDate ? formatDate(u.saleDate) : "—"}</p>
                  </div>
                </div>
                {u.customerName && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Customer: </span>
                    <span className="font-medium">{u.customerName}</span>
                    {u.customerPhone && <span className="text-muted-foreground"> · {u.customerPhone}</span>}
                  </div>
                )}
                {u.saleInvoice && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/sales/${u.id}`}>View invoice →</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
