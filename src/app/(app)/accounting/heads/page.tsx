"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Head = { id: string; name: string; kind: string; txnCount: number };

export default function AccountHeadsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [heads, setHeads] = useState<Head[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("EXP");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/cctv/api/account-heads").then((r) => r.json()).then((d) => { setHeads(d.accountHeads ?? []); setLoading(false); });
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/cctv/api/account-heads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      } else {
        setHeads((h) => [...h, { ...data.accountHead, txnCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        toast({ title: "Added", description: data.accountHead.name });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account heads"
        description="Customizable income/expense categories (doc §4.4)."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/ledger"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="py-4">
          <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="e.g. Internet Bill, Generator Fuel" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="IN">Income</SelectItem><SelectItem value="EXP">Expense</SelectItem></SelectContent>
            </Select>
            <Button type="submit" disabled={saving || !name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </form>
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {heads.map((h) => (
            <Card key={h.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{h.name}</p>
                  <Badge variant="outline" className={h.kind === "IN" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>
                    {h.kind === "IN" ? "Income" : "Expense"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-2">{h.txnCount} txns</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
