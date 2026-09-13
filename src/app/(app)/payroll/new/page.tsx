"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT } from "@/lib/format";

type Employee = { id: string; name: string; role: string; salary: number; status: string };

export default function PayrollSheetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, { basic: string; allowance: string; advanceDeduction: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    setLoading(true);
    const res = await fetch("/api/employees?status=ACTIVE");
    const data = await res.json();
    setEmployees(data.employees ?? []);
    // Initialize records with employee basic salary.
    const init: Record<string, { basic: string; allowance: string; advanceDeduction: string }> = {};
    for (const e of data.employees ?? []) {
      init[e.id] = { basic: String(e.salary), allowance: "0", advanceDeduction: "0" };
    }
    setRecords(init);
    setLoading(false);
  }

  function updateRecord(empId: string, field: "basic" | "allowance" | "advanceDeduction", value: string) {
    setRecords((r) => ({ ...r, [empId]: { ...r[empId], [field]: value } }));
  }

  const totals = employees.reduce(
    (acc, e) => {
      const r = records[e.id];
      if (!r) return acc;
      const net = (Number(r.basic) || 0) + (Number(r.allowance) || 0) - (Number(r.advanceDeduction) || 0);
      return { basic: acc.basic + (Number(r.basic) || 0), allowance: acc.allowance + (Number(r.allowance) || 0), deduction: acc.deduction + (Number(r.advanceDeduction) || 0), net: acc.net + net };
    },
    { basic: 0, allowance: 0, deduction: 0, net: 0 }
  );

  async function onSave() {
    setSaving(true);
    let success = 0;
    let failed = 0;
    for (const e of employees) {
      const r = records[e.id];
      if (!r) continue;
      const res = await fetch("/api/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: e.id, month,
          basic: Number(r.basic) || 0,
          allowance: Number(r.allowance) || 0,
          advanceDeduction: Number(r.advanceDeduction) || 0,
        }),
      });
      if (res.ok) success++;
      else failed++;
    }
    setSaving(false);
    toast({ title: "Payroll saved", description: `${success} record(s) created${failed > 0 ? `, ${failed} already existed` : ""}.` });
    router.push("/employees");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll sheet" description="Generate monthly salary records for all active employees." action={<Button asChild variant="outline" size="sm"><Link href="/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>} />
      <Card>
        <CardContent className="py-4 flex items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
          </div>
          <Button onClick={loadEmployees} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Load employees
          </Button>
        </CardContent>
      </Card>

      {employees.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{month} — {employees.length} employees</CardTitle><CardDescription>Edit basic, allowance, and advance deduction per employee.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border scroll-area-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Employee</th>
                      <th className="text-right font-medium px-3 py-2">Basic</th>
                      <th className="text-right font-medium px-3 py-2">Allowance</th>
                      <th className="text-right font-medium px-3 py-2">Adv. Deduct</th>
                      <th className="text-right font-medium px-3 py-2">Net payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => {
                      const r = records[e.id];
                      const net = r ? (Number(r.basic) || 0) + (Number(r.allowance) || 0) - (Number(r.advanceDeduction) || 0) : 0;
                      return (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2"><p className="font-medium">{e.name}</p><Badge variant="outline" className="text-xs">{e.role}</Badge></td>
                          <td className="px-3 py-2"><Input type="number" step="0.01" value={r?.basic ?? "0"} onChange={(ev) => updateRecord(e.id, "basic", ev.target.value)} className="w-28 text-right" /></td>
                          <td className="px-3 py-2"><Input type="number" step="0.01" value={r?.allowance ?? "0"} onChange={(ev) => updateRecord(e.id, "allowance", ev.target.value)} className="w-28 text-right" /></td>
                          <td className="px-3 py-2"><Input type="number" step="0.01" value={r?.advanceDeduction ?? "0"} onChange={(ev) => updateRecord(e.id, "advanceDeduction", ev.target.value)} className="w-28 text-right" /></td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBDT(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/30">
                    <tr>
                      <td className="px-3 py-2 font-medium">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBDT(totals.basic)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBDT(totals.allowance)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">-{formatBDT(totals.deduction)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{formatBDT(totals.net)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save payroll
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
