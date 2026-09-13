"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/layout/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Truck, Plus, Loader2, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  openingBalance: number;
  currentBalance: number;
  purchaseCount: number;
};

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: async () => {
      const r = await fetch(`/api/suppliers?q=${encodeURIComponent(search)}`);
      return (await r.json()).suppliers as Supplier[];
    },
  });
  const suppliers = data ?? [];

  // ─── Inline quick-edit dialog state ────────────────────────
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", company: "", address: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(s: Supplier) {
    setEditing(s);
    setEditForm({
      name: s.name,
      phone: s.phone ?? "",
      company: s.company ?? "",
      address: s.address ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (editForm.name.trim().length < 2) {
      toast({ title: "Name required", description: "Name must be at least 2 chars.", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/suppliers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || null,
          company: editForm.company.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Update failed.", variant: "destructive" });
        return;
      }
      toast({ title: "Supplier updated", description: `${editForm.name} saved.` });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditing(null);
    } finally {
      setSavingEdit(false);
    }
  }

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        header: "Supplier",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link href={`/suppliers/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { header: "Company", accessorKey: "company", cell: ({ row }) => row.original.company ?? "—" },
      { header: "Phone", accessorKey: "phone", cell: ({ row }) => row.original.phone ?? "—" },
      {
        header: "Opening",
        accessorKey: "openingBalance",
        cell: ({ row }) => <span className="tabular-nums">{formatBDT(row.original.openingBalance)}</span>,
      },
      {
        header: "Balance",
        accessorKey: "currentBalance",
        cell: ({ row }) => {
          const bal = row.original.currentBalance;
          return (
            <span className={`tabular-nums font-medium ${bal > 0 ? "text-amber-600 dark:text-amber-400" : bal < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              {formatBDT(bal)}
            </span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const bal = row.original.currentBalance;
          if (bal > 0) return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Payable</Badge>;
          if (bal < 0) return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Advance</Badge>;
          return <Badge variant="secondary">Settled</Badge>;
        },
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)} title="Quick edit name/phone/company/address">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        ),
      },
    ],
    []
  );

  const totalPayable = suppliers.filter((s) => s.currentBalance > 0).reduce((a, s) => a + s.currentBalance, 0);
  const totalAdvance = suppliers.filter((s) => s.currentBalance < 0).reduce((a, s) => a + s.currentBalance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase CCTV stock from."
        action={
          <Button asChild size="sm">
            <Link href="/suppliers/new"><Plus className="mr-2 h-4 w-4" /> New supplier</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total payable</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatBDT(totalPayable)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total advance</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(-totalAdvance)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Suppliers</p><p className="text-xl font-bold tabular-nums">{suppliers.length}</p></CardContent></Card>
      </div>

      <SearchScanInput value={search} onChange={setSearch} placeholder="Search name / company / phone…" className="max-w-md" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? "No matching suppliers" : "No suppliers yet"}
          description={search ? "Try a different search." : "Add your first supplier to start purchasing stock."}
          action={!search ? (
            <Button asChild><Link href="/suppliers/new"><Plus className="mr-2 h-4 w-4" /> Add supplier</Link></Button>
          ) : undefined}
        />
      ) : (
        <DataTable columns={columns} data={suppliers} maxHeight="max-h-[32rem]" />
      )}

      {/* Inline quick-edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
            <DialogDescription>Quick update of name, phone, company, and address. For opening balance, use the full detail page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="ed-name">Name *</Label>
              <Input id="ed-name" value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ed-phone">Phone</Label>
                <Input id="ed-phone" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-company">Company</Label>
                <Input id="ed-company" value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-address">Address</Label>
              <Textarea id="ed-address" rows={2} value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
