"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { StickyActionBar } from "@/components/layout/sticky-action-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, ArrowLeft, ScanLine, Search, X, AlertTriangle, UserPlus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";

type Product = { id: string; name: string; model: string | null; sku: string; defaultPrice: number | null; unitName: string | null; isSerialised: boolean };
type Supplier = { id: string; name: string; company: string | null };
type CartLine = {
  key: string;
  productId: string;
  productName: string;
  isSerialised: boolean; // F1-S2: false = qty-based (no serial entry)
  qty: string;
  unitPrice: string;
  salesPrice: string;
  warrantyMonths: string;
  serialInput: string;
  serials: string[];
};

function toIsoLocal(d: Date): string {
  // YYYY-MM-DD for <input type="date"> value.
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function NewPurchaseForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const resumeId = searchParams.get("resume");
  const isEditMode = searchParams.get("edit") === "1";

  const [saving, setSaving] = useState(false);
  const [loadingResume, setLoadingResume] = useState(!!resumeId);
  const [supplierId, setSupplierId] = useState("");
  const [mode, setMode] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(""); // editable on edit-mode (auto-gen on create if blank)
  // Initialize date in useEffect to avoid SSR/CSR hydration mismatch
  // (new Date() produces different values depending on timezone + render time).
  const [date, setDate] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Set today's date after hydration (prevents React #418 hydration mismatch).
  useEffect(() => {
    if (!date) setDate(toIsoLocal(new Date()));
  }, [date]);

  // Inline supplier creation dialog state.
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "", phone: "", company: "", address: "", openingBalance: "",
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    fetch("/cctv/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
    fetch("/cctv/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  // Pre-fill from existing purchase when ?resume=ID&edit=1.
  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      try {
        const res = await fetch(`/cctv/api/purchases/${resumeId}`);
        const data = await res.json();
        const purchase = data.purchase;
        if (!purchase) {
          toast({ title: "Not found", description: "Could not load purchase for edit.", variant: "destructive" });
          setLoadingResume(false);
          return;
        }
        setSupplierId(purchase.supplierId ?? "");
        setMode(purchase.mode);
        setPaid(String(purchase.paid || ""));
        setNotes(purchase.notes ?? "");
        setInvoiceNo(purchase.invoiceNo ?? "");
        setDate(toIsoLocal(new Date(purchase.date)));
        setLines(
          (purchase.items as any[]).map((it) => ({
            key: `${it.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: it.productId,
            productName: it.productName,
            isSerialised: it.isSerialised ?? products.find((p) => p.id === it.productId)?.isSerialised ?? true,
            qty: String(it.qty),
            unitPrice: String(it.unitPrice),
            salesPrice: it.salesPrice != null ? String(it.salesPrice) : "",
            warrantyMonths: String(it.warrantyMonths || 0),
            serialInput: "",
            serials: Array.isArray(it.serials) ? it.serials : [],
          }))
        );
      } finally {
        setLoadingResume(false);
      }
    })();
  }, [resumeId, toast]);

  const filteredProducts = products.filter((p) =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.model ?? "").toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  function addProductToCart(p: Product) {
    const key = `${p.id}-${Date.now()}`;
    setLines((l) => [
      ...l,
      {
        key,
        productId: p.id,
        productName: p.name,
        isSerialised: p.isSerialised,
        qty: "1",
        unitPrice: "",
        salesPrice: p.defaultPrice ? String(p.defaultPrice) : "",
        warrantyMonths: "0",
        serialInput: "",
        serials: [],
      },
    ]);
    setProductSearch("");
    setShowProductPicker(false);
  }

  function updateLine(key: string, field: keyof CartLine, value: any) {
    setLines((l) => l.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function removeLine(key: string) {
    setLines((l) => l.filter((line) => line.key !== key));
  }

  // ─── Serial chip management ───────────────────────────────
  function addSerial(key: string, serial: string) {
    const trimmed = serial.trim();
    if (!trimmed) return;
    setLines((l) => l.map((line) => {
      if (line.key !== key) return line;
      if (line.serials.includes(trimmed)) {
        toast({ title: "Duplicate serial", description: `${trimmed} already added.`, variant: "destructive" });
        return line;
      }
      const newSerials = [...line.serials, trimmed];
      const currentQty = Number(line.qty) || 0;
      const newQty = currentQty < newSerials.length ? String(newSerials.length) : line.qty;
      return { ...line, serials: newSerials, serialInput: "", qty: newQty };
    }));
  }

  function removeSerial(key: string, index: number) {
    setLines((l) => l.map((line) => {
      if (line.key !== key) return line;
      const newSerials = line.serials.filter((_, i) => i !== index);
      const currentQty = Number(line.qty) || 0;
      const newQty = currentQty > newSerials.length ? String(newSerials.length || 1) : line.qty;
      return { ...line, serials: newSerials, qty: newQty };
    }));
  }

  function handleSerialInputKeyDown(key: string, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        const parts = value.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) addSerial(key, part);
      }
    }
    if (e.key === "Backspace" && !(e.target as HTMLInputElement).value) {
      setLines((l) => l.map((line) => {
        if (line.key !== key || line.serials.length === 0) return line;
        const newSerials = line.serials.slice(0, -1);
        const currentQty = Number(line.qty) || 0;
        const newQty = currentQty > newSerials.length ? String(newSerials.length || 1) : line.qty;
        return { ...line, serials: newSerials, qty: newQty };
      }));
    }
  }

  function handleSerialInputBlur(key: string, value: string) {
    if (value.trim()) {
      const parts = value.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) addSerial(key, part);
    }
  }

  function getSerialErrors(line: CartLine) {
    const qty = Number(line.qty) || 0;
    const serialCount = line.serials.length;
    return {
      excess: serialCount > qty,
      deficit: serialCount > 0 && serialCount < qty,
    };
  }

  function isDuplicateAcrossLines(serial: string, currentKey: string): boolean {
    return lines.some((l) => l.key !== currentKey && l.serials.includes(serial));
  }

  function hasSaveErrors(): boolean {
    return lines.some((line) => getSerialErrors(line).excess);
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const paidNum = Number(paid) || 0;
  const due = Math.max(0, total - paidNum);
  const totalSerials = lines.reduce((sum, l) => sum + l.serials.length, 0);

  // ─── Inline supplier creation ───────────────────────────────
  async function onCreateSupplier() {
    if (newSupplier.name.trim().length < 2) {
      toast({ title: "Name required", description: "Supplier name must be at least 2 chars.", variant: "destructive" });
      return;
    }
    setCreatingSupplier(true);
    try {
      const payload = {
        name: newSupplier.name.trim(),
        phone: newSupplier.phone.trim() || null,
        company: newSupplier.company.trim() || null,
        address: newSupplier.address.trim() || null,
        openingBalance: Number(newSupplier.openingBalance) || 0,
      };
      const res = await fetch("/cctv/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create supplier.", variant: "destructive" });
        return;
      }
      const created = data.supplier;
      setSuppliers((s) => [...s, { id: created.id, name: created.name, company: created.company ?? null }]);
      setSupplierId(created.id);
      setSupplierDialogOpen(false);
      setNewSupplier({ name: "", phone: "", company: "", address: "", openingBalance: "" });
      toast({ title: "Supplier added", description: `${created.name} ready for this purchase.` });
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function onSave() {
    if (lines.length === 0) {
      toast({ title: "Empty cart", description: "Add at least one product.", variant: "destructive" });
      return;
    }
    for (const line of lines) {
      const qty = Number(line.qty) || 0;
      if (line.serials.length > qty) {
        toast({ title: "Serial count exceeds qty", description: `${line.productName}: ${line.serials.length} serials but qty is ${qty}.`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const payload: any = {
        supplierId: supplierId || null,
        mode,
        paid: paidNum,
        notes: notes || null,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          salesPrice: l.salesPrice ? Number(l.salesPrice) : null,
          warrantyMonths: Number(l.warrantyMonths) || 0,
          serials: l.serials,
        })),
      };
      // Edit-mode includes editMode + invoiceNo + date; create-mode omits them (server auto-generates).
      if (isEditMode && resumeId) {
        payload.editMode = true;
        payload.invoiceNo = invoiceNo.trim() || null;
        payload.date = date ? new Date(date).toISOString() : null;
      }
      const url = isEditMode && resumeId ? `/cctv/api/purchases/${resumeId}` : "/cctv/api/purchases";
      const method = isEditMode && resumeId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not save purchase.", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (isEditMode) {
        toast({ title: "Purchase updated", description: data.message ?? "Saved." });
      } else {
        toast({ title: "Purchase saved", description: `${data.invoiceNo} — ${data.inventoryUnitsCreated} serialised units created.` });
      }
      // Invalidate the purchases query so the list refetches on navigation.
      qc.invalidateQueries({ queryKey: ["purchases"] });
      router.push("/purchases");
    } finally {
      setSaving(false);
    }
  }

  if (loadingResume) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <PageHeader
        title={isEditMode ? "Edit purchase" : "New purchase"}
        description={isEditMode
          ? "Edit items, supplier, prices. Old inventory units + supplier balance are reversed + reapplied transactionally."
          : "Multi-row cart with serial capture. Scan or type serials — they appear as removable chips."}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/purchases"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      {/* Header: supplier + payment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <div className="flex gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Walk-in / select…" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.company ? ` · ${s.company}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSupplierDialogOpen(true)}
                  title="Create new supplier inline"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNo">Invoice no.</Label>
              <Input
                id="invoiceNo"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder={isEditMode ? "" : "Auto-generated if blank"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="BKASH">bKash</SelectItem>
                  <SelectItem value="DUE">Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid">Paid (BDT)</Label>
              <Input id="paid" type="number" min={0} step="0.01" value={paid}
                onChange={(e) => setPaid(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Due</Label>
              <div className="flex h-10 items-center">
                <Badge variant="secondary" className={due > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}>
                  {formatBDT(due)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add products</CardTitle>
          <CardDescription>Search by name, model, or SKU. Scan a barcode to match instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <SearchScanInput value={productSearch} onChange={setProductSearch} placeholder="Search name / model / SKU…" className="flex-1" />
            <Button variant="outline" onClick={() => setShowProductPicker((v) => !v)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {productSearch && (
            <div className="rounded-lg border max-h-60 overflow-y-auto scroll-area-thin">
              {filteredProducts.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No products match. Add one in Products first.</p>
              ) : (
                filteredProducts.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.model ?? "—"} · {p.sku}</p>
                    </div>
                    {p.defaultPrice && <span className="text-xs text-muted-foreground">{formatBDT(p.defaultPrice)}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cart ({lines.length})</CardTitle>
          <CardDescription>Type or scan serials — press Enter or comma to add. Qty auto-updates with serial count.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
              No products added yet. Search above to add.
            </p>
          ) : (
            lines.map((line) => {
              const serialCount = line.serials.length;
              const qty = Number(line.qty) || 0;
              const errors = getSerialErrors(line);
              const lineTotal = qty * (Number(line.unitPrice) || 0);
              return (
                <div key={line.key} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{line.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {line.isSerialised ? (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            <ScanLine className="h-3 w-3 mr-1" /> Serialised
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            <Package className="h-3 w-3 mr-1" /> Non-serialised
                          </Badge>
                        )}
                        {serialCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <ScanLine className="h-3 w-3 mr-1" />{serialCount} serials
                          </Badge>
                        )}
                        {errors.excess && (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />{serialCount}/{qty} — remove {serialCount - qty}
                          </Badge>
                        )}
                        {errors.deficit && !errors.excess && serialCount > 0 && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs">
                            {serialCount}/{qty} — add {qty - serialCount} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Qty + prices grid (warranty only for serialised products) */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2`}>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty {line.isSerialised && serialCount > 0 && `(${serialCount} serials)`}</Label>
                      <Input type="number" step="0.01" min="0" value={line.qty}
                        onChange={(e) => updateLine(line.key, "qty", e.target.value)}
                        placeholder={line.isSerialised ? "matches serial count" : "e.g. 5 rolls"} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit price</Label>
                      <Input type="number" step="0.01" min="0" value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sales price</Label>
                      <Input type="number" step="0.01" min="0" value={line.salesPrice}
                        onChange={(e) => updateLine(line.key, "salesPrice", e.target.value)} placeholder="optional" />
                    </div>
                    {line.isSerialised ? (
                      <div className="space-y-1">
                        <Label className="text-xs">Warranty (mo)</Label>
                        <Input type="number" min="0" value={line.warrantyMonths}
                          onChange={(e) => updateLine(line.key, "warrantyMonths", e.target.value)} />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Warranty</Label>
                        <div className="flex h-9 items-center px-2 rounded-md border bg-muted/30 text-xs text-muted-foreground">N/A</div>
                      </div>
                    )}
                  </div>

                  {/* Serial chips input — only for serialised products */}
                  {line.isSerialised && (
                    <div className="space-y-1">
                      <Label className="text-xs">Serial numbers (scan or type + Enter)</Label>
                      <div className="flex flex-wrap items-center gap-1 rounded-lg border p-2 min-h-[42px] focus-within:ring-2 focus-within:ring-ring">
                        {line.serials.map((serial, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono ${
                              isDuplicateAcrossLines(serial, line.key)
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                            }`}
                          >
                            {serial}
                            <button
                              type="button"
                              onClick={() => removeSerial(line.key, i)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          aria-label="Serial input"
                          value={line.serialInput}
                          onChange={(e) => updateLine(line.key, "serialInput", e.target.value)}
                          onKeyDown={(e) => handleSerialInputKeyDown(line.key, e)}
                          onBlur={(e) => handleSerialInputBlur(line.key, e.target.value)}
                          placeholder={line.serials.length === 0 ? "Scan or type serial + Enter…" : ""}
                          className="flex-1 min-w-[120px] bg-transparent text-xs font-mono outline-none"
                        />
                      </div>
                      {line.serials.some((s) => isDuplicateAcrossLines(s, line.key)) && (
                        <p className="text-xs text-red-600">Duplicate serial detected across products — will be rejected on save.</p>
                      )}
                    </div>
                  )}
                  {!line.isSerialised && (
                    <p className="text-xs text-muted-foreground italic">
                      Qty-based item — no serial numbers required. Stock tracked via purchase/sale totals.
                    </p>
                  )}

                  <div className="text-right text-sm">
                    <span className="text-muted-foreground">Line total: </span>
                    <span className="font-medium">{formatBDT(lineTotal)}</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items</span><span className="tabular-nums">{lines.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Serialised units</span><span className="tabular-nums">{totalSerials}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-bold tabular-nums">{formatBDT(total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{formatBDT(paidNum)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Due</span><span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatBDT(due)}</span></div>
            <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2" />
          </CardContent>
        </Card>
      )}

      <StickyActionBar>
        <Button onClick={onSave} disabled={saving || lines.length === 0 || hasSaveErrors()} className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEditMode ? "Update purchase" : "Save purchase"}
        </Button>
      </StickyActionBar>
      <div className="hidden md:flex md:justify-end">
        <Button onClick={onSave} disabled={saving || lines.length === 0 || hasSaveErrors()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEditMode ? "Update purchase" : "Save purchase"}
        </Button>
      </div>

      {/* Inline supplier creation dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>Create a supplier without leaving the purchase form. The new supplier is auto-selected when saved.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="sup-name">Name *</Label>
              <Input id="sup-name" value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="e.g. Hikvision Bangladesh" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sup-phone">Phone</Label>
                <Input id="sup-phone" value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="01xxxxxxxxx" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-company">Company</Label>
                <Input id="sup-company" value={newSupplier.company}
                  onChange={(e) => setNewSupplier({ ...newSupplier, company: e.target.value })}
                  placeholder="optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-address">Address</Label>
              <Input id="sup-address" value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sup-ob">Opening balance (BDT)</Label>
              <Input id="sup-ob" type="number" step="0.01" value={newSupplier.openingBalance}
                onChange={(e) => setNewSupplier({ ...newSupplier, openingBalance: e.target.value })}
                placeholder="0 — positive = payable, negative = advance" />
              <p className="text-xs text-muted-foreground">Use positive for payable, negative for advance.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
            <Button onClick={onCreateSupplier} disabled={creatingSupplier}>
              {creatingSupplier ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewPurchasePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewPurchaseForm />
    </Suspense>
  );
}
