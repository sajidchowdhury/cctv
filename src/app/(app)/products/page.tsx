"use client";

import { useMemo, useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus, AlertTriangle, Loader2, ScanLine, Package, Save } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";
import { TableSkeleton } from "@/components/layout/skeletons";
import { useToast } from "@/hooks/use-toast";
import { suggestIsSerialised } from "@/lib/onhand";

type Product = {
  id: string;
  name: string;
  model: string | null;
  sku: string;
  categoryName: string | null;
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

  // ── Product setup form state (merged from products/new) ──
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

  // Load categories + units once for the setup form dropdowns.
  useEffect(() => {
    Promise.all([
      fetch("/cctv/api/categories").then((r) => r.json()),
      fetch("/cctv/api/units").then((r) => r.json()),
    ]).then(([c, u]) => {
      setCategories(c.categories ?? []);
      setUnits(u.units ?? []);
    });
  }, []);

  // F1-S2: auto-suggest isSerialised when category changes.
  function onCategoryChange(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    const suggested = suggestIsSerialised(cat?.name ?? null);
    setForm((f) => ({ ...f, categoryId, isSerialised: suggested }));
  }

  async function onCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
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
      // Reset form + refetch products list.
      setForm({ name: "", categoryId: "", model: "", unitId: "", safetyStock: 0, isSerialised: true });
      qc.invalidateQueries({ queryKey: ["products"] });
    } finally {
      setSaving(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, lowOnly],
    queryFn: async () => {
      const url = `/cctv/api/products?q=${encodeURIComponent(search)}${lowOnly ? "&lowStock=1" : ""}`;
      const r = await fetch(url);
      return (await r.json()).products as Product[];
    },
  });

  const products = data ?? [];

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      { header: "Product", accessorKey: "name" },
      { header: "Model", accessorKey: "model", cell: ({ row }) => row.original.model ?? "—" },
      { header: "SKU", accessorKey: "sku", cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
      { header: "Category", accessorKey: "categoryName", cell: ({ row }) => row.original.categoryName ?? "—" },
      {
        header: "Tracking",
        id: "tracking",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.isSerialised ? (
              <><ScanLine className="h-3 w-3 mr-1" /> Serialised</>
            ) : (
              <><Package className="h-3 w-3 mr-1" /> Qty-based</>
            )}
          </Badge>
        ),
      },
      { header: "On hand", accessorKey: "onHand", cell: ({ row }) => <span className="tabular-nums">{row.original.onHand}</span> },
      {
        header: "Safety",
        accessorKey: "safetyStock",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.safetyStock}</span>,
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.lowStock ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" /> Low
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</Badge>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Set up new products at the top, browse the catalogue below." />

      {/* ── Product setup form (merged from products/new) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add new product</CardTitle>
          <CardDescription>SKU auto-generated from category + model. All fields except name are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateProduct} className="space-y-4">
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
                  <Select value={form.categoryId} onValueChange={onCategoryChange}>
                    <SelectTrigger id="category" className="flex-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <EntityPicker
                    label="Category"
                    items={categories}
                    createEndpoint="/cctv/api/categories"
                    createBodyBuilder={(name) => ({ name })}
                    onSelect={(c) => onCategoryChange(c.id)}
                    onCreated={(c) => {
                      setCategories((cats) => [...cats, c].sort((a, b) => a.name.localeCompare(b.name)));
                      onCategoryChange(c.id);
                    }}
                  />
                </div>
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
                Save product
              </Button>
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

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} · {products.filter((p) => p.lowStock).length} low-stock
        </CardContent>
      </Card>
    </div>
  );
}
