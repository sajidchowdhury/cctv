"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { SearchScanInput } from "@/components/layout/search-scan-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Users, Loader2, Clock, TrendingUp } from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";

type Customer = {
  id: string; name: string; phone: string | null; type: string;
  currentBalance: number; lastPurchaseDate: string | null; totalSpent: number;
  purchaseCount: number; lastFollowUpDate: string | null; lastRating: string | null;
  nextDueDate: string | null; daysSinceContact: number;
};

const RATING_TONE: Record<string, string> = {
  HAPPY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  NEUTRAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  UNHAPPY: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function CrmPage() {
  const [search, setSearch] = useState("");
  const [callListDays, setCallListDays] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-customers", search, callListDays],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (callListDays > 0) params.set("days", String(callListDays));
      return (await (await fetch(`/api/crm/customers?${params}`)).json()).customers as Customer[];
    },
  });
  const customers = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" description="Customer follow-up + feedback (doc §5.4)." />
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchScanInput value={search} onChange={setSearch} placeholder="Search name / phone…" className="flex-1" />
        <div className="flex gap-2">
          <Button variant={callListDays === 0 ? "default" : "outline"} size="sm" onClick={() => setCallListDays(0)}>All</Button>
          <Button variant={callListDays === 30 ? "default" : "outline"} size="sm" onClick={() => setCallListDays(30)}>30d call list</Button>
          <Button variant={callListDays === 60 ? "default" : "outline"} size="sm" onClick={() => setCallListDays(60)}>60d</Button>
          <Button variant={callListDays === 90 ? "default" : "outline"} size="sm" onClick={() => setCallListDays(90)}>90d</Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12"><Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">{callListDays > 0 ? `No customers needing a call in the last ${callListDays} days.` : "No customers found."}</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card key={c.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/crm/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-sm text-primary mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    )}
                  </div>
                  {c.lastRating && <Badge className={RATING_TONE[c.lastRating] ?? ""} variant="secondary">{c.lastRating}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Total spent</p>
                    <p className="font-medium tabular-nums">{formatBDT(c.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchases</p>
                    <p className="font-medium tabular-nums">{c.purchaseCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last purchase</p>
                    <p className="font-medium">{c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last contact</p>
                    <p className="font-medium">{c.daysSinceContact}d ago</p>
                  </div>
                </div>
                {c.nextDueDate && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" /> Follow-up due: {formatDate(c.nextDueDate)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
