"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Category = { id: string; name: string };
type Unit = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
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
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/units").then((r) => r.json()),
    ]).then(([c, u]) => {
      setCategories(c.categories ?? []);
      setUnits(u.units ?? []);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          categoryId: form.categoryId || null,
          model: form.model || null,
          unitId: form.unitId || null,
          safetyStock: Number(form.safetyStock),
          defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create product.", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Product created", description: `${data.name} — SKU ${data.sku}` });
      router.push("/products");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New product"
        description="SKU auto-generated from category + model."
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
                <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger id="category"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                  <SelectTrigger id="unit"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
