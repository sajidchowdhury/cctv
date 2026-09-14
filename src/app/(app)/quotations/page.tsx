"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/layout/data-table";
import { FileText, Plus, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatBDT, formatDate } from "@/lib/format";

type Quote = {
  id: string;
  quoteNo: string;
  date: string;
  customerName: string;
  projectType: string;
  total: number;
  status: string;
  itemCount: number;
  validUntil: string | null;
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONVERTED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export default function QuotationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => (await (await fetch("/cctv/api/quotations")).json()).quotations as Quote[],
  });
  const quotes = data ?? [];

  const columns = useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        header: "Quote",
        accessorKey: "quoteNo",
        cell: ({ row }) => (
          <Link href={`/quotations/${row.original.id}`} className="font-medium hover:underline">
            {row.original.quoteNo}
          </Link>
        ),
      },
      { header: "Date", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
      { header: "Customer", accessorKey: "customerName" },
      { header: "Type", accessorKey: "projectType" },
      { header: "Items", accessorKey: "itemCount", cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span> },
      { header: "Total", accessorKey: "total", cell: ({ row }) => <span className="tabular-nums font-medium">{formatBDT(row.original.total)}</span> },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => <Badge className={STATUS_TONE[row.original.status] ?? ""} variant="secondary">{row.original.status}</Badge>,
      },
    ],
    []
  );

  const stats = {
    total: quotes.length,
    accepted: quotes.filter((q) => q.status === "ACCEPTED").length,
    converted: quotes.filter((q) => q.status === "CONVERTED").length,
    rejected: quotes.filter((q) => q.status === "REJECTED").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Pre-sale project estimation with convert-to-sale."
        action={
          <Button asChild size="sm">
            <Link href="/quotations/new"><Plus className="mr-2 h-4 w-4" /> New quote</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card2 label="Total" value={String(stats.total)} />
        <Card2 label="Accepted" value={String(stats.accepted)} tone="emerald" />
        <Card2 label="Converted" value={String(stats.converted)} tone="violet" />
        <Card2 label="Rejected" value={String(stats.rejected)} tone="red" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations yet"
          description="Create a project estimate to start quoting CCTV installations."
          action={<Button asChild><Link href="/quotations/new"><Plus className="mr-2 h-4 w-4" /> New quote</Link></Button>}
        />
      ) : (
        <DataTable columns={columns} data={quotes} maxHeight="max-h-[32rem]" />
      )}
    </div>
  );
}

function Card2({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneClass = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "violet" ? "text-violet-600 dark:text-violet-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
