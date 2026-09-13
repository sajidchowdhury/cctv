"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StickyActionBar } from "@/components/layout/sticky-action-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";

type Product = { id: string; name: string; model: string | null; sku: string; defaultPrice: number | null };
type Customer = { id: string; name: string; phone: string | null };
type Line = {
  key: string;
  lineType: "PRODUCT" | "LABOR" | "SERVICE";
  productId: string;
  description: string;
  qty: string;
  unitPrice: string;
  discount: string;
};

export default function NewQuotationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectType, setProjectType] = useState("OTHER");
  const [discount, setDiscount] = useState("");
  const [vat, setVat] = useState("");
  const [validDays, setValidDays] = useState("15");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productSearch, setProductSearch] = useState("");
  useState(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
  });

  const filteredProducts = products.filter((p) =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.model ?? "").toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  function addProductLine(p: Product) {
    setLines((l) => [...l, {
      key: `${p.id}-${Date.now()}`,
      lineType: "PRODUCT",
      productId: p.id,
      description: `${p.name}${p.model ? ` (${p.model})` : ""}`,
      qty: "1",
      unitPrice: p.defaultPrice ? String(p.defaultPrice) : "",
      discount: "0",
    }]);
    setProductSearch("");
  }

  function addTextLine(lineType: "LABOR" | "SERVICE") {
    setLines((l) => [...l, {
      key: `${lineType}-${Date.now()}`,
      lineType,
      productId: "",
      description: "",
      qty: "1",
      unitPrice: "",
      discount: "0",
    }]);
  }

  function updateLine(key: string, field: keyof Line, value: string) {
    setLines((l) => l.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }
  function removeLine(key: string) {
    setLines((l) => l.filter((line) => line.key !== key));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100), 0);
  const discountNum = Number(discount) || 0;
  const vatNum = Number(vat) || 0;
  const total = subtotal - discountNum + (subtotal * vatNum) / 100;

  async function onSave() {
    if (lines.length === 0) {
      toast({ title: "Empty quote", description: "Add at least one line item.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          customerName: customerName || null,
          projectType,
          discount: discountNum,
          vat: vatNum,
          validUntilDays: Number(validDays) || 15,
          termsConditions: terms || null,
          items: lines.map((l) => ({
            productId: l.lineType === "PRODUCT" ? l.productId : null,
            lineType: l.lineType,
            description: l.description,
            qty: Number(l.qty),
            unitPrice: Number(l.unitPrice),
            discount: Number(l.discount) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create quote.", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "Quote created", description: data.quoteNo });
      router.push(`/quotations/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <PageHeader
        title="New quotation"
        description="Project estimation with product, labour, and service lines."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/quotations"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Customer + project</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Existing customer</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setCustomerName(""); }}>
                <SelectTrigger><SelectValue placeholder="Walk-in prospect…" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Or walk-in name</Label>
              <Input id="customerName" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerId(""); }} placeholder="Prospect name" />
            </div>
            <div className="space-y-2">
              <Label>Project type</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                  <SelectItem value="FACTORY">Factory</SelectItem>
                  <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                  <SelectItem value="RETAIL">Retail</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="siteAddress">Site address</Label>
            <Input id="siteAddress" placeholder="Installation location" onChange={() => {}} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add lines</CardTitle>
          <CardDescription>Products, labour, or service charges.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="flex-1" />
            <Button variant="outline" type="button" onClick={() => addTextLine("LABOR")}>+ Labor</Button>
            <Button variant="outline" type="button" onClick={() => addTextLine("SERVICE")}>+ Service</Button>
          </div>
          {productSearch && (
            <div className="rounded-lg border max-h-48 overflow-y-auto scroll-area-thin">
              {filteredProducts.slice(0, 15).map((p) => (
                <button key={p.id} type="button" onClick={() => addProductLine(p)}
                  className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.model ?? "—"} · {p.sku}</p>
                  </div>
                  {p.defaultPrice && <span className="text-xs text-muted-foreground">{formatBDT(p.defaultPrice)}</span>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Line items ({lines.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">No lines added yet.</p>
          ) : (
            lines.map((line) => {
              const lt = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0) * (1 - (Number(line.discount) || 0) / 100);
              return (
                <div key={line.key} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={line.lineType === "PRODUCT" ? "border-blue-300 text-blue-700" : line.lineType === "LABOR" ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>
                      {line.lineType}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input placeholder="Description" value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Qty</Label><Input type="number" step="0.01" value={line.qty} onChange={(e) => updateLine(line.key, "qty", e.target.value)} /></div>
                    <div><Label className="text-xs">Unit price</Label><Input type="number" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} /></div>
                    <div><Label className="text-xs">Disc %</Label><Input type="number" value={line.discount} onChange={(e) => updateLine(line.key, "discount", e.target.value)} /></div>
                  </div>
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
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label className="text-xs">Discount (BDT)</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><Label className="text-xs">VAT %</Label><Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><Label className="text-xs">Valid for (days)</Label><Input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} /></div>
            </div>
            <Textarea placeholder="Terms & conditions (optional)" value={terms} onChange={(e) => setTerms(e.target.value)} className="mt-2" />
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBDT(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">-{formatBDT(discountNum)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT</span><span className="tabular-nums">{formatBDT((subtotal * vatNum) / 100)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="tabular-nums">{formatBDT(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      <StickyActionBar>
        <Button onClick={onSave} disabled={saving || lines.length === 0} className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save quote
        </Button>
      </StickyActionBar>
      <div className="hidden md:flex md:justify-end">
        <Button onClick={onSave} disabled={saving || lines.length === 0}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save quote
        </Button>
      </div>
    </div>
  );
}
