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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NewEmployeePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", role: "STAFF", salary: "", joinDate: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, phone: form.phone || null, role: form.role,
          salary: form.salary ? Number(form.salary) : 0,
          joinDate: form.joinDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not create.", variant: "destructive" });
      } else {
        toast({ title: "Employee created", description: data.employee.name });
        router.push("/employees");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New employee" description="Staff member with monthly salary." action={<Button asChild variant="outline" size="sm"><Link href="/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base">Employee details</CardTitle><CardDescription>All fields except name are optional.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
            <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Karim Uddin" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" /></div>
              <div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STAFF">Staff</SelectItem><SelectItem value="SALESMAN">Salesman</SelectItem><SelectItem value="ACCOUNTANT">Accountant</SelectItem><SelectItem value="INSTALLER">Installer</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="salary">Monthly salary (BDT)</Label><Input id="salary" type="number" min="0" step="0.01" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-2"><Label htmlFor="joinDate">Join date</Label><Input id="joinDate" type="date" value={form.joinDate} onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))} /></div>
            </div>
            <Button type="submit" disabled={saving || !form.name}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save employee</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
