"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Trash2, Printer, Loader2, AlertTriangle, ScanLine, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";
import { InlineEntityCreator } from "@/components/layout/inline-entity-creator";

type Category = { id: string; name: string };
type Unit = { id: string; name: string };
type Product = {
  id: string; name: string; sku: string; model: string | null;
  categoryId: string | null; unitId: string | null;
  safetyStock: number; defaultPrice: number | null; imageUrl: string | null;
  isSerialised: boolean;
  onHand: number; lowStock: boolean;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Product>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/units").then((r) => r.json()),
    ]).then(([p, c, u]) => {
      if (p.product) {
        setProduct(p.product);
        setForm(p.product);
      }
      setCategories(c.categories ?? []);
      setUnits(u.units ?? []);
      setLoading(false);
    });
  }, [id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          categoryId: form.categoryId || null,
          model: form.model || null,
          unitId: form.unitId || null,
          safetyStock: Number(form.safetyStock ?? 0),
          defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : null,
          isSerialised: form.isSerialised,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Update failed.", variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Product updated." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted", description: "Product removed." });
      router.push("/products");
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!product) return <p className="text-muted-foreground">Product not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/products"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">On hand</p><p className="text-2xl font-bold tabular-nums">{product.onHand}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Safety stock</p><p className="text-2xl font-bold tabular-nums">{product.safetyStock}</p></CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Tracking</p>
          <Badge variant="outline" className="mt-1">
            {product.isSerialised ? (
              <><ScanLine className="h-3 w-3 mr-1" /> Serialised</>
            ) : (
              <><Package className="h-3 w-3 mr-1" /> Qty-based</>
            )}
          </Badge>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Status</p>
          {product.lowStock ? (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><AlertTriangle className="h-3 w-3 mr-1" /> Low stock</Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</Badge>
          )}
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit product</CardTitle>
            <CardDescription>SKU is fixed once generated.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    <Select value={form.categoryId ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {/* F7-S1: inline category creation */}
                    <InlineEntityCreator
                      label="Category"
                      endpoint="/api/categories"
                      bodyBuilder={(name) => ({ name })}
                      onCreated={(c) => {
                        setCategories((cats) => [...cats, c].sort((a, b) => a.name.localeCompare(b.name)));
                        setForm((f) => ({ ...f, categoryId: c.id }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <div className="flex gap-2">
                    <Select value={form.unitId ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {/* F7-S1: inline unit creation */}
                    <InlineEntityCreator
                      label="Unit"
                      endpoint="/api/units"
                      bodyBuilder={(name) => ({ name })}
                      onCreated={(u) => {
                        setUnits((us) => [...us, u].sort((a, b) => a.name.localeCompare(b.name)));
                        setForm((f) => ({ ...f, unitId: u.id }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safetyStock">Safety stock</Label>
                  <Input id="safetyStock" type="number" min={0} value={form.safetyStock ?? 0} onChange={(e) => setForm((f) => ({ ...f, safetyStock: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPrice">Default price (BDT)</Label>
                <Input id="defaultPrice" type="number" min={0} step="0.01" value={form.defaultPrice ?? ""} onChange={(e) => setForm((f) => ({ ...f, defaultPrice: e.target.value ? Number(e.target.value) : null }))} />
              </div>

              {/* F1-S2: Serialised toggle */}
              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
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
                        ? "Tracks per-unit via serial numbers. Stock = count of IN_STOCK units."
                        : "Qty-based stock tracking. Stock = ΣPurchase qty − ΣSale qty. No serial entry at purchase."}
                    </p>
                  </div>
                  <Switch
                    id="isSerialised"
                    checked={!!form.isSerialised}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isSerialised: v }))}
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </form>
          </CardContent>
        </Card>

        {/* Barcode label */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Barcode label</CardTitle>
            <CardDescription>Printable SKU label for stock tagging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center bg-white">
              <p className="text-sm font-medium text-black mb-1">{product.name}</p>
              <p className="text-xs text-gray-500 mb-3">{product.model}</p>
              <div className="inline-block bg-white p-2">
                {/* Code39-style barcode using the SKU characters */}
                <svg viewBox="0 0 200 60" className="w-full max-w-[200px] h-12">
                  {product.sku.split("").map((ch, i) => {
                    const w = ch.charCodeAt(0) % 3 + 1;
                    return <rect key={i} x={i * 12} y={0} width={w} height={50} fill="black" />;
                  })}
                </svg>
              </div>
              <p className="text-xs font-mono tracking-widest text-black mt-2">{product.sku}</p>
              {product.defaultPrice && (
                <p className="text-sm font-bold text-black mt-1">{formatBDT(product.defaultPrice)}</p>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print label
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete product</Button>}
          title="Delete this product?"
          description="Soft-deleted — data preserved. Stock units remain in inventory."
          destructive
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}
