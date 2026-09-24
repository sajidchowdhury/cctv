"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Loader2, ArrowLeft, Package, Wrench, RotateCcw, Eraser, Eye, EyeOff, AlertTriangle, User, Search, X, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";
import { useSession } from "next-auth/react";
import { appPath } from "@/lib/app-path";

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
type Customer = { id: string; name: string; phone: string | null; type: string | null };
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
  // Zero-payment confirmation: when user clicks Save with paid=0, show a warning
  // dialog so they explicitly confirm they intend to create an unpaid invoice.
  // Hold mode skips this (held carts aren't real invoices yet).
  const [showZeroPayConfirm, setShowZeroPayConfirm] = useState(false);
  // Stash the pending hold flag so the confirm handler knows which mode to save in.
  const pendingHoldRef = useRef(false);
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
  // Phase 6 / Feature #4: customer picker is now a debounced search (was a
  // one-shot fetch of ALL customers on mount, which was slow for shops with
  // thousands of customers).
  const [customerSearch, setCustomerSearch] = useState("");
  // The selected customer — null = walk-in (no customer selected).
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  // Phase 6 / Feature #10: customer creation dialog state.
  // When true, a Dialog opens with a walk-in vs regular toggle.
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustomerType, setNewCustomerType] = useState<"REGULAR" | "WALK_IN">("REGULAR");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  // Phase C: scan detection — barcode scanners type very fast (<50ms between
  // keys) and end with Enter. We track keystroke timestamps to detect scans.
  const lastKeyTimeRef = useRef<number>(0);
  const isScanRef = useRef<boolean>(false);

  // Phase 6 / Feature #4: debounced customer search — 300ms after the user
  // stops typing, fetch customers matching the search term.
  useEffect(() => {
    // Guard against undefined/null (defensive — state should always be a string).
    const q = (customerSearch ?? "").trim();
    if (!q) { setCustomers([]); return; }
    const timer = setTimeout(() => {
      fetch(`/cctv/api/customers?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setCustomers(d.customers ?? []));
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Phase 6 / Feature #10: create a new customer (walk-in or regular).
  async function createNewCustomer() {
    if (!newCustomerName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setCreatingCustomer(true);
    try {
      const res = await fetch("/cctv/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          address: newCustomerType === "WALK_IN" ? null : (newCustomerAddress.trim() || null),
          type: newCustomerType === "WALK_IN" ? "WALK_IN" : "RETAIL",
          openingBalance: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create customer.", variant: "destructive" });
        return;
      }
      // The API returns { customer: { id, name, phone } } — unwrap the nested object.
      const created = data.customer ?? data;
      // Auto-select the newly created customer.
      const c: Customer = {
        id: created.id,
        name: created.name ?? "",
        phone: newCustomerPhone.trim() || null,
        type: newCustomerType === "WALK_IN" ? "WALK_IN" : "RETAIL",
      };
      setSelectedCustomer(c);
      setCustomerId(c.id);
      setCustomerSearch(c.name ?? "");
      setCustomers([]);
      // Reset form state + close dialog.
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerAddress("");
      setNewCustomerType("REGULAR");
      setShowCreateCustomer(false);
      toast({ title: "Customer created", description: `${c.name} (${newCustomerType === "WALK_IN" ? "Walk-in" : "Regular"})` });
    } finally {
      setCreatingCustomer(false);
    }
  }

  // Search products + serials via API (debounced).
  // Phase C: when a scan is detected, auto-add the exact matching serial.
  useEffect(() => {
    if (!productSearch.trim()) { setProducts([]); return; }
    const q = productSearch.trim();
    const timer = setTimeout(() => {
      fetch(`/cctv/api/sales/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          const results: SearchResult[] = d.results ?? [];
          setProducts(results);

          // Phase C: if this was a scan (fast input + Enter), check for an
          // exact serial match. If found, auto-add it to the cart immediately.
          if (isScanRef.current) {
            isScanRef.current = false;
            // Look for an exact serial match (case-insensitive) across all results.
            for (const p of results) {
              if (!p.isSerialised) continue;
              const exactMatch = p.serials.find(
                (s) => s.serialNo.toLowerCase() === q.toLowerCase()
              );
              if (exactMatch) {
                addProductLine(p, exactMatch.id, exactMatch.serialNo);
                setProductSearch("");
                setProducts([]);
                return;
              }
            }
            // If no exact serial match, check if there's exactly ONE product
            // result with exactly ONE serial — auto-add it (likely a scan
            // that partially matched but uniquely identifies one unit).
            if (results.length === 1 && results[0].isSerialised && results[0].serials.length === 1) {
              const p = results[0];
              const s = p.serials[0];
              addProductLine(p, s.id, s.serialNo);
              setProductSearch("");
              setProducts([]);
              return;
            }
            // If no auto-add happened, the results stay visible so the user
            // can manually pick the serial.
          }
        });
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
        // Phase 6: sync selectedCustomer + customerSearch when resuming.
        if (sale.customer) {
          setSelectedCustomer({
            id: sale.customer.id,
            name: sale.customer.name,
            phone: sale.customer.phone ?? null,
            type: sale.customer.type ?? null,
          });
          setCustomerSearch(sale.customer.name);
        } else {
          setSelectedCustomer(null);
          setCustomerSearch("");
        }
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
          // Phase 6: restore selectedCustomer + customerSearch from draft.
          // Guard against corrupted drafts (e.g. from the bug where
          // selectedCustomer.name was undefined — fixed now, but old drafts
          // may still be in localStorage on the user's browser).
          if (draft.selectedCustomer && typeof draft.selectedCustomer.name === "string") {
            setSelectedCustomer(draft.selectedCustomer);
            setCustomerSearch(draft.selectedCustomer.name);
          } else if (draft.selectedCustomer) {
            // Corrupted draft — clear it so it doesn't crash the page.
            console.warn("Clearing corrupted customer draft from localStorage");
            const cleanDraft = { ...draft, selectedCustomer: null };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(cleanDraft));
          }
        }
      } catch {}
      setHydrated(true);
    }
  }, [resumeId, hydrated]);

  // Auto-save to localStorage whenever cart changes (after hydration).
  useEffect(() => {
    if (!hydrated || resumeId) return;
    const draft = { customerId, mode, paid, discount, notes, lines, selectedCustomer };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [customerId, mode, paid, discount, notes, lines, selectedCustomer, hydrated, resumeId]);

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

  async function onSave(hold: boolean = false, opts?: { forceZeroPayment?: boolean }) {
    if (lines.length === 0) {
      toast({ title: "Empty cart", description: "Add at least one item.", variant: "destructive" });
      return;
    }
    // Zero-payment guard: if not holding, paid=0, and user hasn't explicitly
    // confirmed, prompt them. This is a deliberate-attention check so the
    // salesman consciously decides to release an unpaid invoice.
    if (!hold && paidNum === 0 && !opts?.forceZeroPayment) {
      pendingHoldRef.current = hold;
      setShowZeroPayConfirm(true);
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

      // Auto-open the saved invoice in a new browser tab so the salesman can
      // print / share it immediately without losing the sales list page.
      // Routes to /print/sales/<id> — a bare invoice page (no app shell, no
      // nav) outside the (app) route group. It auto-triggers window.print()
      // on mount, so the user gets the print dialog popping up in the new tab.
      // Only do this for non-held new sales — held sales don't have a printable
      // invoice yet, and edit mode already shows the invoice page.
      const newSaleId = data.id ?? data.sale?.id;
      if (!hold && !isEditMode && newSaleId) {
        try {
          const url = appPath(`/print/sales/${newSaleId}`);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          // Popup blocker — fail silently, user can still navigate manually.
        }
      }

      router.push(hold ? "/sales?held=1" : "/dashboard");
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
              <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sales?held=1"><Pause className="mr-2 h-4 w-4" /> Hold List</Link>
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
                {/* Phase 6 / Feature #4: searchable customer picker (was a plain
                    Select that loaded ALL customers on mount). Now debounced
                    search by name or phone. */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      // Clear selection if the user is editing the search.
                      if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                        setSelectedCustomer(null);
                        setCustomerId("");
                      }
                    }}
                    placeholder="Search name or phone…"
                    className="pl-9"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearch("");
                        setSelectedCustomer(null);
                        setCustomerId("");
                        setCustomers([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Search results dropdown — only show when searching AND
                      no customer is selected yet. */}
                  {customerSearch && !selectedCustomer && customers.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg max-h-60 overflow-y-auto scroll-area-thin">
                      {customers.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerId(c.id);
                            setCustomerSearch(c.name);
                            setCustomers([]);
                          }}
                          className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                        >
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                          </div>
                          {c.type === "WALK_IN" && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                              Walk-in
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* No-results hint */}
                  {customerSearch && !selectedCustomer && customers.length === 0 && customerSearch.length >= 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No match. Click <strong>+ New</strong> to create one.
                    </p>
                  )}
                </div>
                {/* Phase 6 / Feature #10: create customer button — opens a dialog
                    with a walk-in vs regular toggle. */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreateCustomer(true)}
                  title="Create new customer"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {/* Selected customer badge — shows when a customer is picked */}
              {selectedCustomer && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {selectedCustomer.name}
                  </Badge>
                  {selectedCustomer.type === "WALK_IN" && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                      Walk-in
                    </Badge>
                  )}
                </div>
              )}
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
            <SearchScanInput
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Search name / model / SKU / serial — or scan a barcode…"
              className="flex-1"
              onEnter={() => {
                // Phase C: scan detection. Barcode scanners type very fast
                // (<50ms between keys) and end with Enter. If the last few
                // keystrokes were fast, flag this as a scan so the search
                // effect auto-adds the matching serial to the cart.
                const now = Date.now();
                const delta = now - lastKeyTimeRef.current;
                // If the gap between the last key and Enter is <50ms, it's a scan.
                // (Human typists pause longer before pressing Enter.)
                if (delta < 50 && productSearch.trim().length >= 3) {
                  isScanRef.current = true;
                }
                lastKeyTimeRef.current = now;
              }}
              onKeyDownCapture={(e) => {
                // Track keystroke timing for scan detection.
                const now = Date.now();
                const delta = now - lastKeyTimeRef.current;
                // If keys are coming very fast (<50ms apart), accumulate
                // the scan flag. The Enter handler above checks it.
                if (e.key !== "Enter" && delta < 50) {
                  // Fast input detected — likely a scanner.
                }
                lastKeyTimeRef.current = now;
              }}
            />
            <Button variant="outline" type="button" onClick={addServiceLine}><Wrench className="mr-2 h-4 w-4" /> Service line</Button>
          </div>
          {productSearch && (
            <div className="rounded-lg border max-h-96 overflow-y-auto scroll-area-thin divide-y">
              {filteredProducts.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  No in-stock products found. Try a different search or scan.
                  <br />
                  <span className="text-xs">Out-of-stock items are hidden for faster search.</span>
                </p>
              ) : (
                filteredProducts.map((p) => (
                  <div key={p.productId} className="p-3 hover:bg-accent/50 transition-colors">
                    {/* Phase C: result format —
                        PRODUCT MODEL (PRODUCT NAME)
                        SERIAL 1, SERIAL 2, SERIAL 3 (clickable chips)
                    */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => addProductLine(p)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addProductLine(p); } }}
                      className="flex w-full items-start justify-between gap-2 text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        {/* Line 1: PRODUCT MODEL (PRODUCT NAME) */}
                        <p className="text-sm font-medium">
                          {p.model ?? "—"} <span className="text-muted-foreground">({p.name})</span>
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {p.onHand} in stock
                        </Badge>
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
                    {/* Line 2: available serials as clickable chips.
                        Clicking a serial adds that exact unit to the cart.
                        The product header click adds the first serial. */}
                    {p.isSerialised && p.serials.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-1">
                        {p.serials.slice(0, 15).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => addProductLine(p, s.id, s.serialNo)}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-2 py-0.5 text-xs font-mono text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {s.serialNo}
                          </button>
                        ))}
                        {p.serials.length > 15 && (
                          <span className="text-xs text-muted-foreground self-center">+{p.serials.length - 15} more</span>
                        )}
                      </div>
                    )}
                    {/* Non-serialised: show qty-based info + click to add */}
                    {!p.isSerialised && (
                      <div className="mt-1 pl-1">
                        <p className="text-xs text-muted-foreground">Click to add to cart (qty-based)</p>
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
                <div key={line.key} className="rounded-lg border p-3 space-y-3">
                  {/* ── Header: product name + remove ── */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {line.lineType === "PRODUCT" ? (
                        <div className="flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{line.productName}</span>
                        </div>
                      ) : (
                        <Input placeholder="Service description (e.g. Installation charge)" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} className="h-8" />
                      )}
                      {/* Meta: model + serial + type badges — compact single line */}
                      {line.lineType === "PRODUCT" && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {line.productModel && <span className="text-xs text-muted-foreground">{line.productModel}</span>}
                          {line.isSerialised ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-900">Serial</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">Qty</Badge>
                          )}
                          {line.serialNo && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300">
                              {line.serialNo}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeLine(line.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* ── Inputs: Qty / Unit price / Disc % / PP ──
                      2-col on mobile, 4-col on sm+. PP is a compact toggle
                      button (icon + text) instead of a full-width complex
                      element. */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input type="number" step="0.01" min="0" value={line.qty} onChange={(e) => updateLine(line.key, "qty", e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Unit price</Label>
                      <Input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} placeholder="0" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Disc %</Label>
                      <Input type="number" value={line.discount} onChange={(e) => updateLine(line.key, "discount", e.target.value)} className="h-8 text-sm" />
                    </div>
                    {/* PP: compact toggle — icon button + value, not full-width */}
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">
                        PP {line.purchasePrice === null && <span className="italic">(N/A)</span>}
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
                          className={`flex h-8 w-full items-center justify-center gap-1 rounded-md border text-xs transition-colors ${
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
                        <div className="flex h-8 items-center justify-center rounded-md border bg-muted/20 text-[10px] text-muted-foreground italic">
                          No cost
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Margin (compact single-line, only when PP revealed) ── */}
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
                      <div className={`rounded-md border px-2 py-1 text-[11px] flex items-center justify-between ${
                        profitable
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                          : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
                      }`}>
                        <span>
                          Margin: <span className="font-bold">{formatBDT(profit)}</span>
                          <span className="ml-0.5">({marginPct.toFixed(0)}%)</span>
                        </span>
                        <span className="text-muted-foreground text-[10px] hidden sm:inline">
                          Rev {formatBDT(revenue)} − Cost {formatBDT(cost)}
                        </span>
                      </div>
                    );
                  })()}

                  {/* ── Line total — right-aligned, slightly highlighted ── */}
                  <div className="flex justify-end items-baseline gap-1 pt-1 border-t">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Line total</span>
                    <span className="text-sm font-bold tabular-nums">{formatBDT(lt)}</span>
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

      {/* Zero-payment confirmation dialog.
          Triggered when user clicks "Save sale" with paid=0.
          On confirm, forces save with paid=0. On cancel, returns to the form
          so the user can enter a payment amount. */}
      <AlertDialog
        open={showZeroPayConfirm}
        onOpenChange={(open) => {
          // If user dismisses (Escape / click outside), just close — don't save.
          if (!open) setShowZeroPayConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              No payment received
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create an invoice with <strong>BDT 0</strong> received.
              The full amount (<strong>{formatBDT(total)}</strong>) will be recorded as due
              {customerId ? " against this customer" : ""}.
              <br /><br />
              If this is intentional (e.g. credit sale), confirm to proceed.
              Otherwise, cancel and enter the amount you received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel — enter payment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowZeroPayConfirm(false);
                onSave(pendingHoldRef.current, { forceZeroPayment: true });
              }}
            >
              Confirm — save with 0 payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 6 / Feature #10: Customer creation dialog with walk-in vs regular toggle. */}
      <Dialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              Pick the customer type, then enter their details. Walk-in customers show up in a separate ledger filter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Walk-in vs Regular toggle */}
            <div className="space-y-2">
              <Label>Customer type</Label>
              <ToggleGroup
                type="single"
                value={newCustomerType}
                onValueChange={(v) => v && setNewCustomerType(v as "REGULAR" | "WALK_IN")}
                className="justify-stretch"
              >
                <ToggleGroupItem value="REGULAR" className="flex-1">
                  <User className="h-4 w-4 mr-2" /> Regular customer
                </ToggleGroupItem>
                <ToggleGroupItem value="WALK_IN" className="flex-1">
                  <User className="h-4 w-4 mr-2" /> Walk-in customer
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {newCustomerType === "WALK_IN"
                  ? "Walk-in: no address needed. Will appear in the 'Walk-in customers' ledger filter."
                  : "Regular: full customer record with address. Appears in the 'Regular customers' ledger filter."}
              </p>
            </div>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="newCustName">Name *</Label>
              <Input
                id="newCustName"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="newCustPhone">Phone</Label>
              <Input
                id="newCustPhone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </div>
            {/* Address — only for regular customers */}
            {newCustomerType === "REGULAR" && (
              <div className="space-y-2">
                <Label htmlFor="newCustAddr">Address</Label>
                <Input
                  id="newCustAddr"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  placeholder="Shop / home address (optional)"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCustomer(false)}>
              Cancel
            </Button>
            <Button onClick={createNewCustomer} disabled={creatingCustomer || !newCustomerName.trim()}>
              {creatingCustomer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create {newCustomerType === "WALK_IN" ? "walk-in" : "regular"} customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
