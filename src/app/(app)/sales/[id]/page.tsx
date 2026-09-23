"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer, Pause, Link2, ShieldCheck, MessageSquare, RotateCcw, Pencil, Trash2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBDT, formatDate } from "@/lib/format";
import { appPath } from "@/lib/app-path";
import { InvoiceDocument } from "@/components/invoice/invoice-document";

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  // Warranty SMS feature is not active yet — show a "coming soon" modal instead
  // of calling the SMS API. Set to true to show the modal.
  const [showSmsComingSoon, setShowSmsComingSoon] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: async () => (await (await fetch(`/cctv/api/sales/${id}`)).json()).sale,
    enabled: !!id,
  });

  // Fetch business profile for invoice customization (header/footer images, accent color, productsPerPage).
  const { data: profile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => {
      const r = await fetch("/cctv/api/business-profile");
      if (!r.ok) return null;
      return (await r.json()).profile;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-muted-foreground">Sale not found.</p>;

  const sale: any = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={sale.invoiceNo}
        description={`${formatDate(sale.date)} · ${sale.customer?.name ?? "Walk-in"}`}
        action={
          <div className="flex gap-2 flex-wrap">
            {sale.isHeld && <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Pause className="h-3 w-3 mr-1" /> Held</Badge>}
            {sale.isHeld && (
              <Button asChild size="sm">
                <Link href={`/sales/new?resume=${id}`}><RotateCcw className="mr-2 h-4 w-4" /> Resume</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/sales"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={appPath(`/print/sales/${id}`)} target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" /> Print
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/cctv/api/sales/${id}/warranty-card.pdf`} target="_blank" rel="noopener noreferrer">
                <ShieldCheck className="mr-2 h-4 w-4" /> Warranty card
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSmsComingSoon(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Warranty SMS
            </Button>
            {!sale.isHeld && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/sales/new?resume=${id}&edit=1`}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-destructive" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
              }
              title="Delete this sale?"
              description="This will restore all sold units to IN_STOCK and reverse the customer's balance. The sale is soft-deleted (data preserved). This action cannot be undone."
              destructive
              confirmLabel="Delete sale"
              onConfirm={async () => {
                setDeleting(true);
                try {
                  const res = await fetch(`/cctv/api/sales/${id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast({ title: "Failed", description: data.error ?? "Delete failed.", variant: "destructive" });
                  } else {
                    toast({ title: "Sale deleted", description: data.message });
                    qc.invalidateQueries({ queryKey: ["sales"] });
                    router.push("/sales");
                  }
                } finally {
                  setDeleting(false);
                }
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.total)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold tabular-nums">{formatBDT(sale.paid)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Due</p><p className={`text-xl font-bold tabular-nums ${sale.due > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{formatBDT(sale.due)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Mode</p><Badge variant="secondary">{sale.mode}</Badge></CardContent></Card>
      </div>

      {sale.quotationId && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-violet-500" />
            <span className="text-muted-foreground">Converted from quotation.</span>
            <Link href={`/quotations/${sale.quotationId}`} className="font-medium text-violet-600 dark:text-violet-400 hover:underline">View quote →</Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Invoice markup delegated to the shared InvoiceDocument component.
              Phase 2 changes the table structure (warranty column + new item
              layout) in that single component — both on-screen and print pages
              get the change automatically. */}
          <InvoiceDocument sale={sale} profile={profile} />
        </CardContent>
      </Card>

      {/* Warranty SMS — feature is not active yet. Modal informs the user
          that it will be enabled on demand. */}
      <AlertDialog open={showSmsComingSoon} onOpenChange={setShowSmsComingSoon}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-sky-500" />
              Warranty SMS — coming soon
            </AlertDialogTitle>
            <AlertDialogDescription>
              This feature will be enabled on demand. It is not active yet.
              <br /><br />
              When enabled, the Warranty SMS button will send a text message
              to the customer with their warranty details + invoice reference.
              For now, please use the <strong>Warranty card</strong> button
              to download a printable PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
