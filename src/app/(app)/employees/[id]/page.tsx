"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatBDT, formatDate } from "@/lib/format";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => (await (await fetch(`/cctv/api/employees/${id}`)).json()).employee,
    enabled: !!id,
  });

  if (employee && !form.name && Object.keys(form).length === 0) {
    setForm({ name: employee.name, phone: employee.phone ?? "", role: employee.role, salary: String(employee.salary), status: employee.status });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/cctv/api/employees/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone || null, role: form.role, salary: Number(form.salary) || 0, status: form.status }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Failed", description: data.error, variant: "destructive" }); }
      else { toast({ title: "Saved" }); qc.invalidateQueries({ queryKey: ["employee", id] }); }
    } finally { setSaving(false); }
  }

  async function onDelete() {
    const res = await fetch(`/cctv/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Deleted" }); router.push("/employees"); }
  }

  async function disburseSalary(recordId: string) {
    const res = await fetch(`/cctv/api/salary-records/${recordId}/disburse`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { toast({ title: "Failed", description: data.error, variant: "destructive" }); }
    else { toast({ title: "Disbursed", description: data.message }); qc.invalidateQueries({ queryKey: ["employee", id] }); }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!employee) return <p className="text-muted-foreground">Employee not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={employee.name} description={<Badge variant="outline">{employee.role}</Badge> as any} action={<Button asChild variant="outline" size="sm"><Link href="/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Edit</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Role</Label><Select value={form.role ?? "STAFF"} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="STAFF">Staff</SelectItem><SelectItem value="SALESMAN">Salesman</SelectItem><SelectItem value="ACCOUNTANT">Accountant</SelectItem><SelectItem value="INSTALLER">Installer</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="salary">Salary (BDT)</Label><Input id="salary" type="number" step="0.01" value={form.salary ?? ""} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Status</Label><Select value={form.status ?? "ACTIVE"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="RESIGNED">Resigned</SelectItem></SelectContent></Select></div>
              </div>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Salary history ({employee.salaryRecords.length})</CardTitle></CardHeader>
          <CardContent>
            {employee.salaryRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No salary records. Generate payroll →</p>
            ) : (
              <div className="space-y-2">
                {employee.salaryRecords.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-sm">{r.month}</p>
                      <p className="text-xs text-muted-foreground">{formatBDT(r.netPayable)} net</p>
                    </div>
                    {r.paidOn ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Paid {formatDate(r.paidOn)}</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => disburseSalary(r.id)}>Disburse</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end">
        <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>} title="Delete employee?" description="Soft-deleted — salary records preserved." destructive confirmLabel="Delete" onConfirm={onDelete} />
      </div>
    </div>
  );
}
