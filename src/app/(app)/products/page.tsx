"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/layout/data-table";
import { EntityPicker } from "@/components/layout/entity-picker";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus, AlertTriangle, Loader2, ScanLine, Package, Save, Pencil, X, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { TableSkeleton } from "@/components/layout/skeletons";
import { useToast } from "@/hooks/use-toast";
import { suggestIsSerialised } from "@/lib/onhand";

type Product = {
  id: string;
  name: string;
  model: string | null;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  safetyStock: number;
  defaultPrice: number | null;
  isSerialised: boolean;
  onHand: number;
  lowStock: boolean;
};

type Category = { id: string; name: string };
type Unit = { id: string; name: string };

export default function ProductsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  // ── Pagination state ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Product setup form state (merged from products/new) ──
  // editingId is null when creating a new product. When set, the form is in
  // edit mode — submit calls PATCH /api/products/[id] instead of POST.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    model: "",
    unitId: "",
    safetyStock: 0,
    isSerialised: true,
  });

  // ── Searchable category picker state (same pattern as the supplier picker) ──
  // Categories are loaded once on mount (small list) and filtered client-side.
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  // Inline category edit state — when editingCategoryId is set, the category
  // in the dropdown turns into an editable input with save/cancel.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Derived: currently selected category object (for badge + dropdown visibility).
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === form.categoryId) ?? null,
    [categories, form.categoryId]
  );

  // Client-side filtered categories for the dropdown.
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    const list = q
      ? categories.filter((c) => c.name.toLowerCase().includes(q))
      : categories;
    return list.slice(0, 50);
  }, [categories, categorySearch]);

  // Close the category dropdown when clicking outside the picker.
  useEffect(() => {
    if (!categoryDropdownOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        categoryPickerRef.current &&
        !categoryPickerRef.current.contains(e.target as Node)
      ) {
        setCategoryDropdownOpen(false);
        // If the search text doesn't match the selected category, restore it
        // so the input always reflects the current selection when not editing.
        if (selectedCategory && categorySearch !== selectedCategory.name) {
          setCategorySearch(selectedCategory.name);
        }
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [categoryDropdownOpen, selectedCategory, categorySearch]);

  // Load categories + units once for the setup form dropdowns.
  useEffect(() => {
    Promise.all([
      fetch("/cctv/api/categories").then((r) => r.json()),
      fetch("/cctv/api/units").then((r) => r.json()),
    ]).then(([c, u]) => {
      const cats = c.categories ?? [];
      const us = u.units ?? [];
      setCategories(cats);
      setUnits(us);
      // Default unit → "Pcs" (case-insensitive). Only auto-select when no unit
      // is currently set (so editing a product with its own unit is respected).
      const pcsUnit = us.find((x: Unit) => x.name.toLowerCase() === "pcs");
      if (pcsUnit) {
        setForm((f) => ({ ...f, unitId: f.unitId || pcsUnit.id }));
      }
    });
  }, []);

  // Reset to page 1 when the search/filter changes so the user sees fresh results.
  useEffect(() => {
    setPage(1);
  }, [search, lowOnly]);

  // F1-S2: auto-suggest isSerialised when category changes.
  function onCategoryChange(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    const suggested = suggestIsSerialised(cat?.name ?? null);
    setForm((f) => ({ ...f, categoryId, isSerialised: suggested }));
  }

  // Save a renamed category via PATCH /api/categories/[id].
  async function saveCategoryEdit(categoryId: string) {
    const trimmed = editingCategoryName.trim();
    if (trimmed.length < 2) {
      toast({ title: "Name too short", description: "Category name must be at least 2 characters.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/cctv/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not update category.", variant: "destructive" });
        return;
      }
      // Update the local categories list.
      setCategories((cs) => cs.map((c) => (c.id === categoryId ? { ...c, name: data.category.name } : c)));
      // Update the search input if it was showing the old name.
      if (categorySearch === categories.find((c) => c.id === categoryId)?.name) {
        setCategorySearch(data.category.name);
      }
      toast({ title: "Category renamed", description: data.category.name });
    } catch {
      toast({ title: "Error", description: "Could not update category.", variant: "destructive" });
    } finally {
      setEditingCategoryId(null);
    }
  }

  // Load a product into the form for editing. Fetches the full product
  // detail (including categoryId + unitId which the list API doesn't return).
  async function onEditProduct(product: Product) {
    setEditingId(product.id);
    // Prime the form + category search input with what we already know from
    // the list row (categoryId/categoryName are both returned by the list API).
    setForm({
      name: product.name,
      categoryId: product.categoryId ?? "",
      model: product.model ?? "",
      unitId: product.unitId ?? "",
      safetyStock: product.safetyStock,
      isSerialised: product.isSerialised,
    });
    setCategorySearch(product.categoryName ?? "");
    setCategoryDropdownOpen(false);
    // Fetch the full product to confirm categoryId + unitId (in case the list
    // row was stale or the detail response includes more accurate data).
    try {
      const res = await fetch(`/cctv/api/products/${product.id}`);
      const data = await res.json();
      if (data.product) {
        setForm({
          name: data.product.name,
          categoryId: data.product.categoryId ?? "",
          model: data.product.model ?? "",
          unitId: data.product.unitId ?? "",
          safetyStock: data.product.safetyStock,
          isSerialised: data.product.isSerialised,
        });
        // Sync the search input with the resolved category name. The detail
        // response nests category as { id, name } — fall back to categoryName
        // (returned by the list API) just in case.
        const detailCatName =
          data.product.category?.name ?? data.product.categoryName ?? null;
        setCategorySearch(detailCatName ?? "");
      }
    } catch {}
    // Scroll to the form so the user sees it.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onCancelEdit() {
    setEditingId(null);
    setForm({ name: "", categoryId: "", model: "", unitId: "", safetyStock: 0, isSerialised: true });
    setCategorySearch("");
    setCategoryDropdownOpen(false);
  }

  async function onSubmitProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        // Edit mode: PATCH the existing product.
        const res = await fetch(`/cctv/api/products/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            categoryId: form.categoryId || null,
            model: form.model || null,
            unitId: form.unitId || null,
            safetyStock: Number(form.safetyStock),
            isSerialised: form.isSerialised,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Failed", description: data.error ?? "Could not update product.", variant: "destructive" });
          setSaving(false);
          return;
        }
        toast({ title: "Product updated", description: `${data.product.name} — SKU ${data.product.sku}` });
      } else {
        // Create mode: POST a new product.
        const res = await fetch("/cctv/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            categoryId: form.categoryId || null,
            model: form.model || null,
            unitId: form.unitId || null,
            safetyStock: Number(form.safetyStock),
            isSerialised: form.isSerialised,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Failed", description: data.error ?? "Could not create product.", variant: "destructive" });
          setSaving(false);
          return;
        }
        toast({ title: "Product created", description: `${data.name} — SKU ${data.sku}` });
      }
      // Reset form + refetch products list.
      onCancelEdit();
      qc.invalidateQueries({ queryKey: ["products"] });
    } finally {
      setSaving(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, lowOnly, page, pageSize],
    queryFn: async () => {
      const url =
        `/cctv/api/products?q=${encodeURIComponent(search)}` +
        `${lowOnly ? "&lowStock=1" : ""}` +
        `&page=${page}&pageSize=${pageSize}`;
      const r = await fetch(url);
      const json = await r.json();
      return {
        products: (json.products ?? []) as Product[],
        total: (json.total ?? 0) as number,
        totalPages: (json.totalPages ?? 1) as number,
      };
    },
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;

  function onPaginationChange(state: PaginationState) {
    setPage(state.page);
    setPageSize(state.pageSize);
  }

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        // SL — continuous across pages: (page-1) * pageSize + index + 1
        header: "SL",
        id: "sl",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {(page - 1) * pageSize + row.index + 1}
          </span>
        ),
      },
      { header: "Product", accessorKey: "name" },
      { header: "Model", accessorKey: "model", cell: ({ row }) => row.original.model ?? "—" },
      { header: "Category", accessorKey: "categoryName", cell: ({ row }) => row.original.categoryName ?? "—" },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditProduct(row.original)}
            title="Edit product"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [page, pageSize]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Set up new products at the top, browse the catalogue below." />

      {/* ── Product setup form (merged from products/new) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editingId ? (
              <><Pencil className="h-4 w-4" /> Edit product</>
            ) : (
              <><Plus className="h-4 w-4" /> Add new product</>
            )}
          </CardTitle>
          <CardDescription>
            {editingId
              ? "Edit the fields below and click Update. SKU cannot be changed."
              : "SKU auto-generated from category + model. All fields except name are optional."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmitProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product name *</Label>
              <Input id="name" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Dahua 4MP Dome Camera" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <div className="flex gap-2">
                  {/* Searchable category picker — same pattern as the supplier
                      picker. Categories are loaded once on mount (small list)
                      and filtered client-side. */}
                  <div className="relative flex-1" ref={categoryPickerRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="category"
                      value={categorySearch}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCategorySearch(v);
                        setCategoryDropdownOpen(true);
                        // Clear the selection if the user is editing the search
                        // and the value no longer matches the selected category name.
                        if (selectedCategory && v !== selectedCategory.name) {
                          setForm((f) => ({ ...f, categoryId: "" }));
                        }
                      }}
                      onFocus={() => setCategoryDropdownOpen(true)}
                      placeholder="Search category…"
                      className="pl-9"
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategorySearch("");
                          setForm((f) => ({ ...f, categoryId: "" }));
                          setCategoryDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear category"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Dropdown — show when the picker is focused and no category
                        is selected yet. */}
                    {categoryDropdownOpen && !selectedCategory && filteredCategories.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg max-h-60 overflow-y-auto scroll-area-thin">
                        {filteredCategories.map((c) => (
                          <div
                            key={c.id}
                            className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left text-sm hover:bg-accent min-h-[40px]"
                          >
                            {editingCategoryId === c.id ? (
                              // Inline edit mode: input + save + cancel
                              <div className="flex items-center gap-1 flex-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingCategoryName}
                                  onChange={(e) => setEditingCategoryName(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter" && editingCategoryName.trim()) {
                                      await saveCategoryEdit(c.id);
                                    } else if (e.key === "Escape") {
                                      setEditingCategoryId(null);
                                    }
                                  }}
                                  className="flex-1 h-7 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveCategoryEdit(c.id)}
                                  className="text-emerald-600 hover:text-emerald-700 px-1"
                                  title="Save"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCategoryId(null)}
                                  className="text-muted-foreground hover:text-foreground px-1"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              // Normal mode: click to select + pencil to edit
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onCategoryChange(c.id);
                                    setCategorySearch(c.name);
                                    setCategoryDropdownOpen(false);
                                  }}
                                  className="flex-1 truncate text-left"
                                >
                                  {c.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCategoryId(c.id);
                                    setEditingCategoryName(c.name);
                                  }}
                                  className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
                                  title="Edit category name"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* No-results hint */}
                    {categoryDropdownOpen && !selectedCategory && filteredCategories.length === 0 && categorySearch.trim().length >= 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        No categories match &quot;{categorySearch}&quot;.
                      </p>
                    )}
                  </div>
                  <EntityPicker
                    label="Category"
                    items={categories}
                    createEndpoint="/cctv/api/categories"
                    createBodyBuilder={(name) => ({ name })}
                    onSelect={(c) => {
                      onCategoryChange(c.id);
                      setCategorySearch(c.name);
                      setCategoryDropdownOpen(false);
                    }}
                    onCreated={(c) => {
                      setCategories((cats) => [...cats, c].sort((a, b) => a.name.localeCompare(b.name)));
                      onCategoryChange(c.id);
                      setCategorySearch(c.name);
                      setCategoryDropdownOpen(false);
                    }}
                  />
                </div>
                {/* Selected category badge */}
                {selectedCategory && (
                  <Badge variant="secondary" className="text-xs w-fit">
                    {selectedCategory.name}
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. DH-IPC-HFW2431T" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <div className="flex gap-2">
                  <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                    <SelectTrigger id="unit" className="flex-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <EntityPicker
                    label="Unit"
                    items={units}
                    createEndpoint="/cctv/api/units"
                    createBodyBuilder={(name) => ({ name })}
                    onSelect={(u) => setForm((f) => ({ ...f, unitId: u.id }))}
                    onCreated={(u) => {
                      setUnits((us) => [...us, u].sort((a, b) => a.name.localeCompare(b.name)));
                      setForm((f) => ({ ...f, unitId: u.id }));
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="safetyStock">Safety stock</Label>
                <Input id="safetyStock" type="number" min={0} value={form.safetyStock}
                  onChange={(e) => setForm((f) => ({ ...f, safetyStock: Number(e.target.value) }))} />
              </div>
            </div>

            {/* F1-S2: Serialised toggle */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {form.isSerialised ? (
                      <ScanLine className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <Label htmlFor="isSerialised" className="font-medium cursor-pointer">
                      {form.isSerialised ? "Serialised product" : "Non-serialised product"}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.isSerialised
                      ? "Tracks each physical unit by serial number (cameras, DVRs, NVRs). Stock = count of IN_STOCK units."
                      : "Qty-based stock tracking (cables, PSU, accessories). Stock = ΣPurchase qty − ΣSale qty."}
                  </p>
                </div>
                <Switch
                  id="isSerialised"
                  checked={form.isSerialised}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isSerialised: v }))}
                />
              </div>
              {form.categoryId && (
                <Badge variant="outline" className="text-xs">
                  Auto-suggested from category
                </Badge>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving || !form.name}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingId ? "Update product" : "Save product"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={onCancelEdit}>
                  <X className="mr-2 h-4 w-4" /> Cancel edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Product list ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchScanInput
          value={search}
          onChange={setSearch}
          placeholder="Search product name, model, or category…"
          className="flex-1"
        />
        <Button
          variant={lowOnly ? "default" : "outline"}
          onClick={() => setLowOnly((v) => !v)}
          className="sm:w-auto"
        >
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock only
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={search || lowOnly ? "No matching products" : "No products yet"}
          description={search || lowOnly ? "Try a different search or filter." : "Add your first CCTV product using the form above."}
        />
      ) : (
        <DataTable columns={columns} data={products} maxHeight="max-h-[32rem]" />
      )}

      {/* Pagination — 10 per page by default. SL stays continuous across pages. */}
      {!isLoading && products.length > 0 && (
        <ReportPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={onPaginationChange}
        />
      )}

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          {total} product{total !== 1 ? "s" : ""} · {products.filter((p) => p.lowStock).length} low-stock
        </CardContent>
      </Card>
    </div>
  );
}
