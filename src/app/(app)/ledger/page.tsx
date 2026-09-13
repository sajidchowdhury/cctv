"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { BookOpen, Plus, Loader2, Settings, Wallet, ArrowDownCircle, ArrowUpCircle, Receipt } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";

type Txn = {
  id: string;
  type: string;
  amount: number;
  mode: string;
  date: string;
  narration: string | null;
  accountHead: string | null;
};

export default function LedgerPage() {
  const [type, setType] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", type],
    queryFn: async () => (await (await fetch(`/api/transactions${type ? `?type=${type}` : ""}`)).json()).transactions as Txn[],
  });
  const txns = data ?? [];

  const columns = useMemo<ColumnDef<Txn>[]>(
    () => [
      {
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => (
          <Badge variant="outline" className={row.original.type === "IN" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>
            {row.original.type === "IN" ? <ArrowDownCircle className="h-3 w-3 mr-1" /> : <ArrowUpCircle className="h-3 w-3 mr-1" />}
            {row.original.type === "IN" ? "Income" : "Expense"}
          </Badge>
        ),
      },
      { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
      { header: "Account head", accessorKey: "accountHead", cell: ({ row }) => row.original.accountHead ?? "—" },
      { header: "Narration", accessorKey: "narration", cell: ({ row }) => row.original.narration ?? "—" },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => (
          <span className={`tabular-nums font-medium ${row.original.type === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {row.original.type === "IN" ? "+" : "-"}{formatBDT(row.original.amount)}
          </span>
        ),
      },
      { header: "Mode", accessorKey: "mode" },
    ],
    []
  );

  const totalIn = txns.filter((t) => t.type === "IN").reduce((s, t) => s + t.amount, 0);
  const totalExp = txns.filter((t) => t.type === "EXP").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Income, expense, and cash book (doc §4.4)."
        action={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link href="/receipts/new"><Receipt className="mr-2 h-4 w-4" /> Receipt</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/payments/new"><Receipt className="mr-2 h-4 w-4" /> Payment</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/accounting/heads"><Settings className="mr-2 h-4 w-4" /> Heads</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/accounting/cash-book"><Wallet className="mr-2 h-4 w-4" /> Cash book</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/accounting/new"><Plus className="mr-2 h-4 w-4" /> New entry</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Total income</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(totalIn)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Total expense</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatBDT(totalExp)}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Net</p><p className={`text-xl font-bold tabular-nums ${totalIn - totalExp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatBDT(totalIn - totalExp)}</p></div>
      </div>

      <div className="flex gap-2">
        <Button variant={!type ? "default" : "outline"} size="sm" onClick={() => setType("")}>All</Button>
        <Button variant={type === "IN" ? "default" : "outline"} size="sm" onClick={() => setType("IN")}>Income only</Button>
        <Button variant={type === "EXP" ? "default" : "outline"} size="sm" onClick={() => setType("EXP")}>Expense only</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : txns.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No transactions yet"
          description="Record income or expense to start your cash book."
          action={<Button asChild><Link href="/accounting/new"><Plus className="mr-2 h-4 w-4" /> New entry</Link></Button>}
        />
      ) : (
        <DataTable columns={columns} data={txns} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}
