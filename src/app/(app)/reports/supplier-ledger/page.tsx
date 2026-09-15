"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Printer, Truck, Search } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";

type Supplier = { id: string; name: string; company: string | null; currentBalance: number };

export default function SupplierLedgerReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [supplierId, setSupplierId] = useState("");
  const [appliedSupplierId, setAppliedSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Debounce search input — 300ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await (await fetch("/cctv/api/suppliers")).json()).suppliers as Supplier[],
  });
  const suppliers = suppliersData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["report-supplier-ledger", appliedSupplierId, appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      if (!appliedSupplierId) return null;
      const params = new URLSearchParams({
        partyId: appliedSupplierId,
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/supplier-ledger?${params}`)).json();
    },
    enabled: !!appliedSupplierId,
  });

  const ledger: any[] = data?.rows ?? [];
  const summary = data?.summary;
  const supplier = data?.supplier;

  function applyFilters() {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedSupplierId(supplierId);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier ledger"
        description="Party-wise all transactions + running balance (doc §5.3)."
        action={
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!ledger.length} data-print-hidden>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        }
      />

      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.company ? `· ${s.company}` : ""} · Bal {formatBDT(s.currentBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={applyFilters} />
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference / narration / type…"
              className="pl-9"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={applyFilters} disabled={!supplierId}>
              <Truck className="mr-2 h-4 w-4" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {supplier && (
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Supplier Ledger: {supplier.name}</h1>
          <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
        </div>
      )}

      {!appliedSupplierId ? (
        <div className="text-center py-12">
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select a supplier + date range above to view the ledger.</p>
        </div>
      ) : isLoading || !data ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Opening</p><p className="text-xl font-bold tabular-nums">{summary?.openingDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total debit</p><p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.totalDebitDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total credit</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary?.totalCreditDisplay ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Closing</p><p className="text-xl font-bold tabular-nums">{summary?.closingDisplay ?? "—"}</p></CardContent></Card>
          </div>

          <div className="flex justify-end" data-print-hidden>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`supplier-ledger-${supplier?.name ?? "x"}-${appliedFrom}-to-${appliedTo}`, ledger.map((e) => ({
              date: e.date, type: e.type, reference: e.ref, narration: e.narration ?? "",
              debit: e.debit, credit: e.credit, balance: e.balance,
            })))} disabled={!ledger.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          {ledger.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No transactions in this period.</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto rounded-lg border scroll-area-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Date</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Type</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Reference</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Mode</th>
                      <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Narration</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Debit</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Credit</th>
                      <th className="text-right font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDate(e.date)}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{e.type}</Badge></td>
                        <td className="px-4 py-3 font-medium">{e.ref}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.mode ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.narration ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{e.debitDisplay}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.creditDisplay}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{e.balanceDisplay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="sm:hidden space-y-2">
                {ledger.map((e: any, i: number) => (
                  <li key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{e.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    </div>
                    <p className="font-medium text-sm">{e.ref}</p>
                    {e.narration && <p className="text-xs text-muted-foreground">{e.narration}</p>}
                    <div className="flex items-center justify-between pt-1 text-sm">
                      <div className="flex gap-3">
                        <span className="text-amber-600 dark:text-amber-400">Dr: {e.debitDisplay}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Cr: {e.creditDisplay}</span>
                      </div>
                      <span className="font-medium tabular-nums">Bal: {e.balanceDisplay}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <ReportPagination
                page={data?.page ?? 1}
                pageSize={data?.pageSize ?? pageSize}
                total={data?.total ?? 0}
                onChange={({ page: p, pageSize: ps }: PaginationState) => { setPage(p); setPageSize(ps); }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
