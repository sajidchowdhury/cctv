"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Lock, Unlock, Info, User, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { formatBDT, formatDate } from "@/lib/format";

type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };
type Product = { id: string; name: string; model: string | null; sku: string };

// Phase 4: extended to include lastSale + purchase history for auto-detection.
type LastSale = {
  saleId: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  salePrice: number | null;
} | null;

type PurchaseInfo = {
  purchaseId: string;
  invoiceNo: string;
  date: string;
  supplierId: string;
  supplierName: string | null;
  supplierPhone: string | null;
  unitPrice: number | null;
} | null;

type InventoryUnit = {
  id: string;
  serialNo: string;
  productName: string;
  warrantyEnd: string | null;
  status: string;
  lastSale: LastSale;
  purchase: PurchaseInfo;
};

export default function NewRmaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [faultReason, setFaultReason] = useState("");
  const [vendorRmaRef, setVendorRmaRef] = useState("");
  const [vendorCharge, setVendorCharge] = useState("");
  const [eta, setEta] = useState("");
  const [serialSearch, setSerialSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);

  // Phase 4: when customer/supplier are auto-filled from the serial's history,
  // the selects lock so the user can't accidentally change them. They can
  // click "Unlock & override" to lift the lock for edge cases (e.g. unit was
  // resold, supplier changed).
  const [customerLocked, setCustomerLocked] = useState(false);
  const [supplierLocked, setSupplierLocked] = useState(false);

  useEffect(() => {
    fetch("/cctv/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
    fetch("/cctv/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  useEffect(() => {
    if (!serialSearch) { setInventoryUnits([]); return; }
    fetch(`/cctv/api/inventory-units?status=ALL&q=${encodeURIComponent(serialSearch)}`).then((r) => r.json()).then((d) => setInventoryUnits(d.inventoryUnits ?? []));
  }, [serialSearch]);

  // Phase 4: when a serial is selected, auto-fill customer + supplier from
  // the unit's history. The fields lock so the user can't accidentally change
  // them — they must explicitly click "Unlock & override" to lift the lock.
  function selectUnit(u: InventoryUnit) {
    setSelectedUnit(u);
    setSerialSearch("");

    // Reset locks before applying auto-fill.
    setCustomerLocked(false);
    setSupplierLocked(false);

    if (u.lastSale?.customerId) {
      setCustomerId(u.lastSale.customerId);
      setCustomerLocked(true);
    } else {
      setCustomerId("");
    }

    if (u.purchase?.supplierId) {
      setSupplierId(u.purchase.supplierId);
      setSupplierLocked(true);
    } else {
      setSupplierId("");
    }

    // Toast informing the user the fields were auto-filled.
    const filled: string[] = [];
    if (u.lastSale?.customerId) filled.push("customer");
    if (u.purchase?.supplierId) filled.push("supplier");
    if (filled.length > 0) {
      toast({
        title: "Auto-detected from serial",
        description: `${filled.join(" + ")} filled from the unit's history and locked.`,
      });
    } else {
      toast({
        title: "No history found",
        description: "This serial has no sale or purchase record. Pick customer + vendor manually.",
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/cctv/api/rma", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          inventoryUnitId: selectedUnit?.id || null,
          productId: selectedUnit ? null : null,
          supplierId: supplierId || null,
          faultReason,
          vendorRmaRef: vendorRmaRef || null,
          vendorCharge: vendorCharge ? Number(vendorCharge) : 0,
          eta: eta || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Failed", description: data.error, variant: "destructive" }); }
      else { toast({ title: "RMA created", description: data.rmaNo }); router.push("/rma"); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New RMA" description="Open a repair ticket for a faulty unit (doc §5.7). Auto-detects customer + vendor from the serial's history." action={<Button asChild variant="outline" size="sm"><Link href="/rma"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base">RMA details</CardTitle><CardDescription>Search by serial — customer + vendor auto-fill from history if the unit was sold.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label>Find product by serial</Label>
              <SearchScanInput value={serialSearch} onChange={setSerialSearch} placeholder="Scan or type serial number…" />
              {serialSearch && (
                <div className="rounded-lg border max-h-60 overflow-y-auto scroll-area-thin">
                  {inventoryUnits.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No units found.</p> : inventoryUnits.slice(0, 10).map((u) => (
                    <button key={u.id} type="button" onClick={() => selectUnit(u)}
                      className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent">
                      <div>
                        <p className="text-sm font-medium">{u.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{u.serialNo}</p>
                        {/* Phase 4: show sale + purchase status inline in the dropdown so the
                            user knows which unit has history before clicking. */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {u.lastSale && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                              Sold to {u.lastSale.customerName ?? "—"}
                            </span>
                          )}
                          {u.purchase && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                              From {u.purchase.supplierName ?? "—"}
                            </span>
                          )}
                          {!u.lastSale && !u.purchase && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              No history
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs ${u.warrantyEnd && new Date(u.warrantyEnd) > new Date() ? "text-emerald-600" : "text-red-600"}`}>{u.warrantyEnd && new Date(u.warrantyEnd) > new Date() ? "In warranty" : "Out of warranty"}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUnit && (
                <div className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedUnit.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">Serial: {selectedUnit.serialNo}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setSelectedUnit(null);
                      setCustomerId("");
                      setSupplierId("");
                      setCustomerLocked(false);
                      setSupplierLocked(false);
                    }}>
                      Change serial
                    </Button>
                  </div>
                  <p className="text-xs">
                    Warranty: {selectedUnit.warrantyEnd ? new Date(selectedUnit.warrantyEnd) > new Date() ? "In warranty (free)" : "Expired (chargeable)" : "No warranty"}
                  </p>
                </div>
              )}
            </div>

            {/* Phase 4: auto-detected info panel — shows sale + purchase history
                when a serial is selected. Read-only, just for the user's info. */}
            {selectedUnit && (selectedUnit.lastSale || selectedUnit.purchase) && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-900 p-3 space-y-2">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Auto-detected from serial history
                </p>
                {selectedUnit.lastSale && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1 col-span-2"><User className="h-3 w-3" /> Sold to</p>
                    <div className="col-span-2 pl-4">
                      <p className="font-medium">{selectedUnit.lastSale.customerName ?? "—"}</p>
                      {selectedUnit.lastSale.customerPhone && (
                        <p className="text-muted-foreground">{selectedUnit.lastSale.customerPhone}</p>
                      )}
                      <p className="text-muted-foreground">
                        Invoice {selectedUnit.lastSale.invoiceNo} · {formatDate(selectedUnit.lastSale.date)}
                        {selectedUnit.lastSale.salePrice !== null && ` · ${formatBDT(selectedUnit.lastSale.salePrice)}`}
                      </p>
                    </div>
                  </div>
                )}
                {selectedUnit.purchase && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1 col-span-2"><Truck className="h-3 w-3" /> Purchased from</p>
                    <div className="col-span-2 pl-4">
                      <p className="font-medium">{selectedUnit.purchase.supplierName ?? "—"}</p>
                      {selectedUnit.purchase.supplierPhone && (
                        <p className="text-muted-foreground">{selectedUnit.purchase.supplierPhone}</p>
                      )}
                      <p className="text-muted-foreground">
                        Invoice {selectedUnit.purchase.invoiceNo} · {formatDate(selectedUnit.purchase.date)}
                        {selectedUnit.purchase.unitPrice !== null && ` · ${formatBDT(selectedUnit.purchase.unitPrice)}`}
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Customer + vendor fields below are locked because they were inferred from this serial's history. Click "Unlock" if you need to override.
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Customer — locked when auto-filled */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Customer</Label>
                  {customerLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setCustomerLocked(false)}
                    >
                      <Unlock className="h-3 w-3 mr-1" /> Unlock
                    </Button>
                  )}
                </div>
                <Select value={customerId} onValueChange={setCustomerId} disabled={customerLocked}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {customerLocked && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Auto-filled from sale history
                  </p>
                )}
              </div>

              {/* Vendor / supplier — locked when auto-filled */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Vendor / supplier</Label>
                  {supplierLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSupplierLocked(false)}
                    >
                      <Unlock className="h-3 w-3 mr-1" /> Unlock
                    </Button>
                  )}
                </div>
                <Select value={supplierId} onValueChange={setSupplierId} disabled={supplierLocked}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {supplierLocked && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Auto-filled from purchase history
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2"><Label htmlFor="faultReason">Fault reason *</Label><Textarea id="faultReason" required value={faultReason} onChange={(e) => setFaultReason(e.target.value)} placeholder="Customer-reported symptom" rows={2} /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label htmlFor="vendorRmaRef">Vendor RMA ref</Label><Input id="vendorRmaRef" value={vendorRmaRef} onChange={(e) => setVendorRmaRef(e.target.value)} placeholder="Vendor's ref" /></div>
              <div className="space-y-2"><Label htmlFor="vendorCharge">Vendor charge (BDT)</Label><Input id="vendorCharge" type="number" step="0.01" value={vendorCharge} onChange={(e) => setVendorCharge(e.target.value)} placeholder="0 if in warranty" /></div>
              <div className="space-y-2"><Label htmlFor="eta">ETA</Label><Input id="eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
            </div>
            <Button type="submit" disabled={saving || !faultReason}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Create RMA</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
