"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wallet, Loader2 } from "lucide-react";
import { formatBDT, formatDateTime } from "@/lib/format";

export default function CashBookPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useQuery({
    queryKey: ["cash-book", date],
    queryFn: async () => (await (await fetch(`/api/reports/cash-book?date=${date}`)).json()),
  });

  const cb = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash book"
        description="Day-wise cash in/out with closing balance (doc §4.4)."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/ledger"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="py-4 flex items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
        </CardContent>
      </Card>

      {isLoading || !cb ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Opening cash</p><p className="text-xl font-bold tabular-nums">{formatBDT(cb.openingCash)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Cash in</p><p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatBDT(cb.totalIn)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Cash out</p><p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatBDT(cb.totalOut)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Closing cash</p><p className="text-xl font-bold tabular-nums">{formatBDT(cb.closingCash)}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="py-4">
              {cb.entries.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No cash transactions on this day.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border scroll-area-thin">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Time</th>
                        <th className="text-left font-medium px-3 py-2">Type</th>
                        <th className="text-left font-medium px-3 py-2">Reference</th>
                        <th className="text-left font-medium px-3 py-2">Narration</th>
                        <th className="text-right font-medium px-3 py-2">In</th>
                        <th className="text-right font-medium px-3 py-2">Out</th>
                        <th className="text-right font-medium px-3 py-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cb.entries.map((e: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(e.date)}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className={e.direction === "in" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>{e.type}</Badge></td>
                          <td className="px-3 py-2 font-medium">{e.ref}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.narration ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.direction === "in" ? e.amountDisplay : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{e.direction === "out" ? e.amountDisplay : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{e.balanceDisplay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
