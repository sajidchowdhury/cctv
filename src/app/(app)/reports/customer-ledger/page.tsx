"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { ReportPagination, type PaginationState } from "@/components/layout/report-pagination";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Printer, Users, Search, X, User } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Customer = { id: string; name: string; phone: string | null; type: string | null; currentBalance: number };

export default function CustomerLedgerReportPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [customerId, setCustomerId] = useState("");
  const [appliedCustomerId, setAppliedCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  // Phase 6 / Feature #10: customer type filter — All / Regular / Walk-in.
  // Sent to the API as a query param so the search respects the type filter.
  const [typeFilter, setTypeFilter] = useState<"ALL" | "REGULAR" | "WALK_IN">("ALL");
  // Phase 6+: searchable customer picker (was a one-shot fetch of ALL
  // customers on mount, bad UX for shops with 100+ customers).
  // Customers only appear when the user types.
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Debounce search input — 300ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Phase 6+: debounced customer search — 300ms after the user stops typing,
  // fetch customers matching the search term + type filter. Only fires when
  // customerSearch is non-empty, so no customers are loaded until the user types.
  useEffect(() => {
    const q = (customerSearch ?? "").trim();
    if (!q) { setCustomers([]); return; }
    const timer = setTimeout(() => {
      // Send the type filter to the API so the search respects it.
      // The API supports ?q= for name/phone search. We filter by type
      // client-side after the results come back (simpler than adding a
      // type param to the API + keeps the existing API contract).
      fetch(`/cctv/api/customers?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          let list: Customer[] = d.customers ?? [];
          // Apply the type filter client-side.
          if (typeFilter === "WALK_IN") list = list.filter((c) => c.type === "WALK_IN");
          else if (typeFilter === "REGULAR") list = list.filter((c) => c.type !== "WALK_IN");
          setCustomers(list);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, typeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-customer-ledger", appliedCustomerId, appliedFrom, appliedTo, page, pageSize, appliedSearch],
    queryFn: async () => {
      if (!appliedCustomerId) return null;
      const params = new URLSearchParams({
        partyId: appliedCustomerId,
        from: appliedFrom,
        to: appliedTo,
        page: String(page),
        pageSize: String(pageSize),
        ...(appliedSearch ? { q: appliedSearch } : {}),
      });
      return await (await fetch(`/cctv/api/reports/customer-ledger?${params}`)).json();
    },
    enabled: !!appliedCustomerId,
  });

  const ledger: any[] = data?.rows ?? [];
  const summary = data?.summary;
  const customer = data?.customer;

  function applyFilters() {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedCustomerId(customerId);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer ledger"
        description="Party-wise all transactions + running balance (doc §5.3)."
        action={
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!ledger.length} data-print-hidden>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        }
      />

      {/* Filters: party picker + date range — hidden in print */}
      <Card data-print-hidden>
        <CardContent className="py-4 space-y-3">
          {/* Phase 6 / Feature #10: customer type filter — All / Regular / Walk-in */}
          <div className="space-y-2">
            <Label>Customer type</Label>
            <ToggleGroup
              type="single"
              value={typeFilter}
              onValueChange={(v) => v && setTypeFilter(v as "ALL" | "REGULAR" | "WALK_IN")}
              className="justify-stretch"
            >
              <ToggleGroupItem value="ALL" className="flex-1 text-xs">All customers</ToggleGroupItem>
              <ToggleGroupItem value="REGULAR" className="flex-1 text-xs">Regular only</ToggleGroupItem>
              <ToggleGroupItem value="WALK_IN" className="flex-1 text-xs">Walk-in only</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              {/* Phase 6+: searchable customer picker (was a plain Select that
                  loaded ALL customers on mount). Now customers only appear when
                  the user types — same pattern as the customer picker in
                  sales/new + product-movement report. */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    // Clear selection if the user is editing the search.
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                      setCustomerId("");
                    }
                  }}
                  placeholder="Search customer name or phone…"
                  className="pl-9"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearch("");
                      setSelectedCustomer(null);
                      setCustomerId("");
                      setCustomers([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Search results dropdown — only show when searching AND
                    no customer is selected yet. */}
                {customerSearch && !selectedCustomer && customers.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg max-h-60 overflow-y-auto scroll-area-thin">
                    {customers.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerId(c.id);
                          setCustomerSearch(c.name);
                          setCustomers([]);
                          setPage(1);
                        }}
                        className="flex w-full items-center justify-between border-b last:border-0 px-3 py-2 text-left hover:bg-accent"
                      >
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.phone && <p className="text-xs text-muted-foreground">{c.phone} · Bal {formatBDT(c.currentBalance)}</p>}
                        </div>
                        {c.type === "WALK_IN" && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                            Walk-in
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* No-results hint */}
                {customerSearch && !selectedCustomer && customers.length === 0 && customerSearch.length >= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No {typeFilter === "WALK_IN" ? "walk-in " : typeFilter === "REGULAR" ? "regular " : ""}customers match.
                  </p>
                )}
              </div>
              {/* Selected customer badge — shows when a customer is picked */}
              {selectedCustomer && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {selectedCustomer.name}
                  </Badge>
                  {selectedCustomer.type === "WALK_IN" && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                      Walk-in
                    </Badge>
                  )}
                </div>
              )}
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
            <Button onClick={applyFilters} disabled={!customerId}>
              <Users className="mr-2 h-4 w-4" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print header — only visible when printing */}
      {customer && (
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Customer Ledger: {customer.name}</h1>
          <p className="text-sm">Period: {appliedFrom} to {appliedTo}</p>
        </div>
      )}

      {!appliedCustomerId ? (
        <div className="text-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select a customer + date range above to view the ledger.</p>
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
            <Button variant="outline" size="sm" onClick={() => exportToCSV(`customer-ledger-${customer?.name ?? "x"}-${appliedFrom}-to-${appliedTo}`, ledger.map((e) => ({
              date: e.date, type: e.type, reference: e.ref, narration: e.narration ?? "",
              debit: e.debit, credit: e.credit, balance: e.balance,
            })))} disabled={!ledger.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          {ledger.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No transactions in this period.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
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

              {/* Mobile cards */}
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
