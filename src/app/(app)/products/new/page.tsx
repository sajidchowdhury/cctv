"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Save, ScanLine, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { suggestIsSerialised } from "@/lib/onhand";
import { EntityPicker } from "@/components/layout/entity-picker";

type Category = { id: string; name: string };
type Unit = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    model: "",
    unitId: "",
    safetyStock: 0,
    defaultPrice: "",
    isSerialised: true,
  });

  useEffect(() => {
    Promise.all([
      fetch("/cctv/api/categories").then((r) => r.json()),
      fetch("/cctv/api/units").then((r) => r.json()),
    ]).then(([c, u]) => {
      setCategories(c.categories ?? []);
      setUnits(u.units ?? []);
    });
  }, []);

  // F1-S2: auto-suggest isSerialised when category changes (Camera/DVR → true, Cable/PSU → false).
  // Only auto-suggest on NEW products (not on edit — preserve the existing flag there).
  function onCategoryChange(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    const suggested = suggestIsSerialised(cat?.name ?? null);
    setForm((f) => ({ ...f, categoryId, isSerialised: suggested }));
  }

  async function onSubmit(e: React.FormEvent) {
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
          defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : null,
          isSerialised: form.isSerialised,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create product.", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Product created", description: `${data.name} — SKU ${data.sku} — ${data.isSerialised ? "Serialised" : "Non-serialised"}` });
      // Invalidate the products query so the list refetches on navigation
      // (without this, React Query returns the cached list missing the new product).
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New product"
        description="SKU auto-generated from category + model. Toggle serialised mode per product."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/products"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product details</CardTitle>
          <CardDescription>All fields except name are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
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
                  {/* EntityPicker: search/select existing + add new (no page refresh) */}
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
                  {/* EntityPicker: search/select existing + add new (no page refresh) */}
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
            <div className="space-y-2">
              <Label htmlFor="defaultPrice">Default sales price (BDT)</Label>
              <Input id="defaultPrice" type="number" min={0} step="0.01" value={form.defaultPrice}
                onChange={(e) => setForm((f) => ({ ...f, defaultPrice: e.target.value }))}
                placeholder="Auto-fills sales (doc §4.2)" />
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
                      ? "Tracks each physical unit by serial number (cameras, DVRs, NVRs). Stock = count of IN_STOCK units. Required at purchase time."
                      : "Qty-based stock tracking (cables, PSU, accessories). Stock = ΣPurchase qty − ΣSale qty. No serial entry at purchase."}
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
              <Button type="button" variant="outline" asChild>
                <Link href="/products">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
