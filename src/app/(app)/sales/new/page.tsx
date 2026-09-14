"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { StickyActionBar } from "@/components/layout/sticky-action-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, ArrowLeft, Package, Wrench, RotateCcw, Eraser, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";
import { useSession } from "next-auth/react";
import { InlineEntityCreator } from "@/components/layout/inline-entity-creator";

type SearchResult = {
  productId: string;
  name: string;
  model: string | null;
  sku: string;
  defaultPrice: number | null;
  purchasePrice: number | null; // F2-S3 — last cost for margin display (role-gated on UI)
  isSerialised: boolean; // F1-S2
  onHand: number;
  outOfStock: boolean;
  serials: { id: string; serialNo: string }[];
};
type Customer = { id: string; name: string; phone: string | null };
type CartLine = {
  key: string;
  productId: string;
  productName: string;
  productModel: string | null;
  isSerialised: boolean; // F1-S2: false = qty-based (no serial pick)
  purchasePrice: number | null; // F2-S3 — last cost (null for service lines)
  inventoryUnitId: string;
  serialNo: string;
  qty: string;
  unitPrice: string;
  discount: string;
  lineType: "PRODUCT" | "SERVICE";
  description: string;
};

const DRAFT_KEY = "cctv-sale-draft";

export default function NewSalePageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewSalePage />
    </Suspense>
  );
}

function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume");
  const isEditMode = searchParams.get("edit") === "1";
  const { toast } = useToast();
  const { data: session } = useSession();
  // F2-S3: only OWNER + MANAGER can reveal purchase price. SALESMAN always sees ***.
  const role = session?.user?.role as string | undefined;
  const canViewCost = role === "OWNER" || role === "MANAGER";
  // Track which cart lines + search results have PP revealed (per-line toggle).
  const [revealedLines, setRevealedLines] = useState<Set<string>>(new Set());
  const [revealedSearch, setRevealedSearch] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [mode, setMode] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [products, setProducts] = useState<SearchResult[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Load customers once.
  useEffect(() => {
    fetch("/cctv/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
  }, []);

  // Search products + serials via API (debounced).
  useEffect(() => {
    if (!productSearch.trim()) { setProducts([]); return; }
    const timer = setTimeout(() => {
      fetch(`/cctv/api/sales/search?q=${encodeURIComponent(productSearch.trim())}`)
        .then((r) => r.json())
        .then((d) => setProducts(d.results ?? []));
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Resume: load a held sale's items into the cart.
  useEffect(() => {
    if (!resumeId) return;
    fetch(`/cctv/api/sales/${resumeId}`)
      .then((r) => r.json())
      .then((data) => {
        const sale = data.sale;
        if (!sale) return;
        setCustomerId(sale.customerId ?? "");
        setMode(sale.mode);
        setPaid(String(sale.paid));
        setDiscount(String(sale.discount));
        setNotes(sale.notes ?? "");
        setLines(
          sale.items.map((it: any) => ({
            key: it.id,
            productId: it.productId ?? "",
            productName: it.product?.name ?? it.description ?? "",
            productModel: it.product?.model ?? null,
            // F1-S2: derive isSerialised from whether inventoryUnitId is set.
            // If the item has an inventory unit → serialised; otherwise qty-based (non-serial or service).
            isSerialised: !!(it.inventoryUnitId || (it.inventoryUnit && it.inventoryUnit.serialNo)),
            // F2-S3: for resume/edit, fetch purchasePrice from product relation if available.
            // The sale GET includes product with { id, name, model, sku } — no purchaseItems.
            // Set null; the PP field will show "N/A" in edit mode (acceptable since cost is historical).
            purchasePrice: null,
            inventoryUnitId: it.inventoryUnitId ?? "",
            serialNo: it.inventoryUnit?.serialNo ?? "",
            qty: String(it.qty),
            unitPrice: String(it.unitPrice),
            discount: String(it.discount),
            lineType: it.lineType as "PRODUCT" | "SERVICE",
            description: it.description ?? "",
          }))
        );
        toast({ title: "Held sale loaded", description: `${sale.invoiceNo} — review and finalize.` });
      });
  }, [resumeId, toast]);

  // localStorage persistence: auto-save cart on change (offline-tolerant, doc §6).
  useEffect(() => {
    if (resumeId) return; // don't override draft when resuming
    if (!hydrated) {
      // Restore from localStorage on first mount.
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          setCustomerId(draft.customerId ?? "");
          setMode(draft.mode ?? "CASH");
          setPaid(draft.paid ?? "");
          setDiscount(draft.discount ?? "");
          setNotes(draft.notes ?? "");
          setLines(draft.lines ?? []);
        }
      } catch {}
      setHydrated(true);
    }
  }, [resumeId, hydrated]);

  // Auto-save to localStorage whenever cart changes (after hydration).
  useEffect(() => {
    if (!hydrated || resumeId) return;
    const draft = { customerId, mode, paid, discount, notes, lines };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [customerId, mode, paid, discount, notes, lines, hydrated, resumeId]);

  const filteredProducts = products; // already filtered by API

  function addProductLine(p: SearchResult, serialId?: string, serialNo?: string) {
    // Stock check: block out-of-stock products.
    if (p.outOfStock) {
      toast({ title: "Out of stock", description: `${p.name} has no available stock. Create a purchase first.`, variant: "destructive" });
      return;
    }

    // F1-S2: branch on isSerialised.
    //   - Serialised: pick a specific inventory unit, qty=1, serialNo shown.
    //   - Non-serialised: qty-based line, no inventoryUnitId, qty editable.
    if (!p.isSerialised) {
      setLines((l) => [...l, {
        key: `${p.productId}-${Date.now()}`,
        productId: p.productId,
        productName: p.name,
        productModel: p.model,
        isSerialised: false,
        purchasePrice: p.purchasePrice,  // F2-S3
        inventoryUnitId: "",
        serialNo: "",
        qty: "1",
        unitPrice: p.defaultPrice ? String(p.defaultPrice) : "",
        discount: "0",
        lineType: "PRODUCT",
        description: p.name,
      }]);
      setProductSearch("");
      return;
    }

    // Serialised path: serial pick.
    if (p.serials.length === 0) {
      toast({ title: "No serials in stock", description: `${p.name} has no IN_STOCK units. Create a purchase first.`, variant: "destructive" });
      return;
    }
    const selectedSerial = serialId
      ? { id: serialId, serialNo: serialNo ?? "" }
      : p.serials[0];

    setLines((l) => [...l, {
      key: `${p.productId}-${Date.now()}`,
      productId: p.productId,
      productName: p.name,
      productModel: p.model,
      isSerialised: true,
      purchasePrice: p.purchasePrice,  // F2-S3
      inventoryUnitId: selectedSerial?.id ?? "",
      serialNo: selectedSerial?.serialNo ?? "",
      qty: "1",
      unitPrice: p.defaultPrice ? String(p.defaultPrice) : "",
      discount: "0",
      lineType: "PRODUCT",
      description: p.name,
    }]);
    setProductSearch("");
  }

  function addServiceLine() {
    setLines((l) => [...l, {
      key: `svc-${Date.now()}`,
      productId: "",
      productName: "",
      productModel: null,
      isSerialised: false,
      purchasePrice: null,  // F2-S3 — service lines have no cost
      inventoryUnitId: "",
      serialNo: "",
      qty: "1",
      unitPrice: "",
      discount: "0",
      lineType: "SERVICE",
      description: "",
    }]);
  }

  function updateLine(key: string, field: keyof CartLine, value: string) {
    setLines((l) => l.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }
  function removeLine(key: string) {
    setLines((l) => l.filter((line) => line.key !== key));
  }

  function clearDraft() {
    setCustomerId("");
    setMode("CASH");
    setPaid("");
    setDiscount("");
    setNotes("");
    setLines([]);
    localStorage.removeItem(DRAFT_KEY);
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100), 0);
  const discountNum = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountNum);
  const paidNum = Number(paid) || 0;
  const due = Math.max(0, total - paidNum);

  async function onSave(hold: boolean = false) {
    if (lines.length === 0) {
      toast({ title: "Empty cart", description: "Add at least one item.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId: customerId || null,
        mode,
        paid: paidNum,
        discount: discountNum,
        notes: notes || null,
        isHeld: hold,
        items: lines.map((l) => ({
          productId: l.lineType === "PRODUCT" ? l.productId : null,
          inventoryUnitId: l.inventoryUnitId || null,
          description: l.lineType === "SERVICE" ? l.description : null,
          lineType: l.lineType,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          discount: Number(l.discount) || 0,
          warrantyMonths: 0,
        })),
      };

      let res;
      if (resumeId && isEditMode) {
        // Full edit: PATCH with editMode + all items + stock/ledger reversal.
        res = await fetch(`/cctv/api/sales/${resumeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editMode: true,
            customerId: customerId || null,
            mode,
            paid: paidNum,
            discount: discountNum,
            notes: notes || null,
            items: lines.map((l) => ({
              productId: l.lineType === "PRODUCT" ? l.productId : null,
              inventoryUnitId: l.inventoryUnitId || null,
              description: l.lineType === "SERVICE" ? l.description : null,
              lineType: l.lineType,
              qty: Number(l.qty),
              unitPrice: Number(l.unitPrice),
              discount: Number(l.discount) || 0,
              warrantyMonths: 0,
            })),
          }),
        });
      } else if (resumeId) {
        // Finalize the held sale: PATCH to un-hold + update fields.
        res = await fetch(`/cctv/api/sales/${resumeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHeld: hold, paid: paidNum, mode, notes: notes || null }),
        });
      } else {
        res = await fetch("/cctv/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not save sale.", variant: "destructive" });
        setSaving(false);
        return;
      }
      // Clear localStorage draft on successful save.
      localStorage.removeItem(DRAFT_KEY);
      const invoiceNo = data.invoiceNo ?? data.sale?.invoiceNo;
      toast({ title: isEditMode ? "Sale updated" : hold ? "Sale held" : "Sale saved", description: isEditMode ? (data.message ?? invoiceNo) : invoiceNo });
      router.push(hold ? "/sales?held=1" : "/sales");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <PageHeader
        title={isEditMode ? "Edit sale" : resumeId ? "Resume held sale" : "New sale"}
        description={isEditMode ? "Edit items, prices, and payment. Stock + ledger are reversed and reapplied on save." : resumeId ? "Review and finalize the held cart." : "Cart-based invoicing. Stock decreases on save. Draft auto-saves."}
        action={
          <div className="flex gap-2">
            {!resumeId && lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearDraft} className="text-muted-foreground">
                <Eraser className="mr-2 h-4 w-4" /> Clear draft
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/sales"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
          </div>
        }
      />

      {/* Resume banner */}
      {resumeId && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/50 dark:border-violet-900 px-4 py-3 text-sm text-violet-800 dark:text-violet-200 flex items-center gap-2">
          <RotateCcw className="h-4 w-4" /> Resuming a held sale. Finalize to complete the transaction.
        </div>
      )}

      {/* Draft restored indicator */}
      {!resumeId && hydrated && lines.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/50 dark:border-sky-900 px-4 py-2 text-xs text-sky-700 dark:text-sky-300">
          Draft restored from your last session (auto-saved to this device).
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Invoice details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="flex gap-2">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Walk-in…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* F7-S1: inline customer creation */}
                <InlineEntityCreator
                  label="Customer"
                  endpoint="/cctv/api/customers"
                  bodyBuilder={(name, extra) => ({
                    name,
                    phone: extra.phone || null,
                    type: "RETAIL",
                    openingBalance: 0,
                  })}
                  extraFields={[
                    { key: "phone", label: "Phone", placeholder: "01XXXXXXXXX" },
                  ]}
                  namePlaceholder="Customer name"
                  onCreated={(c) => {
                    setCustomers((cs) => [...cs, { id: c.id, name: c.name, phone: null }]);
                    setCustomerId(c.id);
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="BKASH">bKash</SelectItem>
                  <SelectItem value="NAGAD">Nagad</SelectItem>
                  <SelectItem value="DUE">Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid">Paid (BDT)</Label>
              <Input id="paid" type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add items</CardTitle>
          <CardDescription>Search by product name, model, SKU, or serial number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <SearchScanInput value={productSearch} onChange={setProductSearch} placeholder="Search name / model / SKU / serial…" className="flex-1" />
            <Button variant="outline" type="button" onClick={addServiceLine}><Wrench className="mr-2 h-4 w-4" /> Service line</Button>
          </div>
          {productSearch && (
            <div className="rounded-lg border max-h-96 overflow-y-auto scroll-area-thin divide-y">
              {filteredProducts.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No products found. Try a different search.</p>
              ) : (
                filteredProducts.map((p) => (
                  <div key={p.productId} className={`p-3 ${p.outOfStock ? "opacity-50" : "hover:bg-accent/50"} transition-opacity`}>
                    {/* Product header row — click adds to cart with auto-selected first serial.
                        F5-S2 fix: outer element is a div (not button) so the inner PP reveal
                        button doesn't cause a nested-button hydration error. */}
                    <div
                      role="button"
                      tabIndex={p.outOfStock ? -1 : 0}
                      onClick={() => { if (!p.outOfStock) addProductLine(p); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !p.outOfStock) { e.preventDefault(); addProductLine(p); } }}
                      className={`flex w-full items-start justify-between gap-2 text-left ${p.outOfStock ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.model ?? "—"} · {p.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.outOfStock ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                            Out of stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            {p.onHand} in stock
                          </Badge>
                        )}
                        <Badge variant="outline" className="ml-1 text-xs">
                          {p.isSerialised ? "Serialised" : "Qty-based"}
                        </Badge>
                        {p.defaultPrice && (
                          <p className="text-xs text-muted-foreground mt-1">{formatBDT(p.defaultPrice)}</p>
                        )}
                        {/* F2-S3: PP field with role-gated click-to-reveal */}
                        {p.purchasePrice !== null && p.purchasePrice !== undefined ? (
                          <button
                            type="button"
                            disabled={!canViewCost}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canViewCost) return;
                              setRevealedSearch((s) => {
                                const next = new Set(s);
                                if (next.has(p.productId)) next.delete(p.productId);
                                else next.add(p.productId);
                                return next;
                              });
                            }}
                            className={`mt-1 inline-flex items-center gap-1 text-xs ${canViewCost ? "text-muted-foreground hover:text-foreground cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
                            title={canViewCost ? "Click to reveal purchase price" : "Purchase price hidden (insufficient role)"}
                          >
                            {canViewCost && revealedSearch.has(p.productId) ? (
                              <><EyeOff className="h-3 w-3" />PP: {formatBDT(p.purchasePrice)}</>
                            ) : (
                              <><Eye className="h-3 w-3" />PP: ***</>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {/* Available serials — click a specific serial to add that exact unit */}
                    {p.serials.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-1">
                        {p.serials.slice(0, 10).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => addProductLine(p, s.id, s.serialNo)}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-2 py-0.5 text-xs font-mono text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {s.serialNo}
                          </button>
                        ))}
                        {p.serials.length > 10 && (
                          <span className="text-xs text-muted-foreground self-center">+{p.serials.length - 10} more</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cart ({lines.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
              No items added yet. Search above to add.
            </p>
          ) : (
            lines.map((line) => {
              const lt = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0) * (1 - (Number(line.discount) || 0) / 100);
              return (
                <div key={line.key} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={line.lineType === "PRODUCT" ? "border-blue-300 text-blue-700" : "border-emerald-300 text-emerald-700"}>
                      {line.lineType}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {line.lineType === "PRODUCT" ? (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{line.productName}</span>
                      {line.productModel && <span className="text-xs text-muted-foreground">{line.productModel}</span>}
                      {line.isSerialised ? (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900">Serialised</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">Qty-based</Badge>
                      )}
                    </div>
                  ) : (
                    <Input placeholder="Service description (e.g. Installation charge)" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} />
                  )}
                  {line.lineType === "PRODUCT" && line.serialNo && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Serial:</span>
                      <Badge variant="outline" className="font-mono text-xs border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300">
                        {line.serialNo}
                      </Badge>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><Label className="text-xs">Qty</Label><Input type="number" step="0.01" min="0" value={line.qty} onChange={(e) => updateLine(line.key, "qty", e.target.value)} /></div>
                    <div><Label className="text-xs">Unit price</Label><Input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} placeholder="0" /></div>
                    <div><Label className="text-xs">Disc %</Label><Input type="number" value={line.discount} onChange={(e) => updateLine(line.key, "discount", e.target.value)} /></div>
                    {/* F2-S3: PP field — *** by default, click to reveal (OWNER/MANAGER only). */}
                    <div>
                      <Label className="text-xs">
                        PP {line.purchasePrice === null && <span className="text-muted-foreground italic">(N/A)</span>}
                      </Label>
                      {line.purchasePrice !== null ? (
                        <button
                          type="button"
                          disabled={!canViewCost}
                          onClick={() => {
                            if (!canViewCost) return;
                            setRevealedLines((s) => {
                              const next = new Set(s);
                              if (next.has(line.key)) next.delete(line.key);
                              else next.add(line.key);
                              return next;
                            });
                          }}
                          className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors ${
                            canViewCost
                              ? "cursor-pointer hover:bg-accent"
                              : "cursor-not-allowed opacity-60"
                          } ${revealedLines.has(line.key) && canViewCost
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900"
                              : "bg-muted/30 text-muted-foreground"
                          }`}
                          title={canViewCost ? "Click to reveal purchase price" : "Purchase price hidden (insufficient role)"}
                        >
                          {revealedLines.has(line.key) && canViewCost ? (
                            <><EyeOff className="h-3 w-3" /><span className="font-medium">{formatBDT(line.purchasePrice)}</span></>
                          ) : (
                            <><Eye className="h-3 w-3" /><span>***</span></>
                          )}
                        </button>
                      ) : (
                        <div className="flex h-9 items-center px-3 rounded-md border bg-muted/20 text-xs text-muted-foreground italic">
                          No cost data
                        </div>
                      )}
                    </div>
                  </div>
                  {/* F2-S3: margin display when PP is revealed + role allows */}
                  {line.lineType === "PRODUCT" && line.purchasePrice !== null && canViewCost && revealedLines.has(line.key) && (() => {
                    const unitPriceNum = Number(line.unitPrice) || 0;
                    const qtyNum = Number(line.qty) || 0;
                    const discountNum = Number(line.discount) || 0;
                    const revenue = unitPriceNum * qtyNum * (1 - discountNum / 100);
                    const cost = (line.purchasePrice ?? 0) * qtyNum;
                    const profit = revenue - cost;
                    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                    const profitable = profit >= 0;
                    return (
                      <div className={`rounded-md border px-3 py-2 text-xs flex items-center justify-between ${
                        profitable
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                          : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
                      }`}>
                        <span>
                          Margin: <span className="font-bold">{formatBDT(profit)}</span>
                          <span className="ml-1">({marginPct.toFixed(1)}%)</span>
                        </span>
                        <span className="text-muted-foreground">
                          Revenue {formatBDT(revenue)} − Cost {formatBDT(cost)}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="text-right text-sm"><span className="text-muted-foreground">Line total: </span><span className="font-medium">{formatBDT(lt)}</span></p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBDT(subtotal)}</span></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs">Invoice discount (BDT)</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></div>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="tabular-nums font-medium">{formatBDT(total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{formatBDT(paidNum)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-1"><span>Due</span><span className="tabular-nums text-amber-600 dark:text-amber-400">{formatBDT(due)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      <StickyActionBar>
        <Button onClick={() => onSave(false)} disabled={saving || lines.length === 0} className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isEditMode ? "Update sale" : resumeId ? "Finalize sale" : "Save sale"}
        </Button>
        {!resumeId && !isEditMode && (
          <Button variant="outline" onClick={() => onSave(true)} disabled={saving || lines.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Hold
          </Button>
        )}
      </StickyActionBar>
      <div className="hidden md:flex md:justify-end gap-2">
        {!resumeId && !isEditMode && (
          <Button variant="outline" onClick={() => onSave(true)} disabled={saving || lines.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Hold cart
          </Button>
        )}
        <Button onClick={() => onSave(false)} disabled={saving || lines.length === 0}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isEditMode ? "Update sale" : resumeId ? "Finalize sale" : "Save sale"}
        </Button>
      </div>
    </div>
  );
}
