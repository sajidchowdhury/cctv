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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SearchScanInput } from "@/components/layout/search-scan-input";

type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };
type Product = { id: string; name: string; model: string | null; sku: string };
type InventoryUnit = { id: string; serialNo: string; productName: string; warrantyEnd: string | null; status: string };

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

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
    fetch("/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  useEffect(() => {
    if (!serialSearch) { setInventoryUnits([]); return; }
    fetch(`/api/inventory-units?status=ALL&q=${encodeURIComponent(serialSearch)}`).then((r) => r.json()).then((d) => setInventoryUnits(d.inventoryUnits ?? []));
  }, [serialSearch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/rma", {
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
      <PageHeader title="New RMA" description="Open a repair ticket for a faulty unit (doc §5.7)." action={<Button asChild variant="outline" size="sm"><Link href="/rma"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base">RMA details</CardTitle><CardDescription>Auto-warranty check runs when a serial is linked.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Find product by serial</Label>
              <SearchScanInput value={serialSearch} onChange={setSerialSearch} placeholder="Scan or type serial number…" />
              {serialSearch && (
                <div className="rounded-lg border max-h-48 overflow-y-auto scroll-area-thin">
                  {inventoryUnits.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No units found.</p> : inventoryUnits.slice(0, 10).map((u) => (
                    <button key={u.id} type="button" onClick={() => { setSelectedUnit(u); setSerialSearch(""); }}
                      className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent">
                      <div><p className="text-sm font-medium">{u.productName}</p><p className="text-xs text-muted-foreground font-mono">{u.serialNo}</p></div>
                      <span className={`text-xs ${u.warrantyEnd && new Date(u.warrantyEnd) > new Date() ? "text-emerald-600" : "text-red-600"}`}>{u.warrantyEnd && new Date(u.warrantyEnd) > new Date() ? "In warranty" : "Out of warranty"}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUnit && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{selectedUnit.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">Serial: {selectedUnit.serialNo}</p>
                  <p className="text-xs">Warranty: {selectedUnit.warrantyEnd ? new Date(selectedUnit.warrantyEnd) > new Date() ? "In warranty (free)" : "Expired (chargeable)" : "No warranty"}</p>
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Customer</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Vendor / supplier</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
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
