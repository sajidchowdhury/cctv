"use client";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function WarrantyExpiryReportPage() {
  const { data } = useQuery({
    queryKey: ["warranty-expiry-report"],
    queryFn: async () => (await (await fetch("/api/warranty/lookup")).json()),
  });
  const units = data?.units ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Warranty expiry" description="Sold units and their warranty status (doc §5.3)." action={<Button asChild variant="outline" size="sm"><Link href="/warranty">Warranty lookup →</Link></Button>} />
      {units.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No sold units" description="Warranty records appear here once you sell serialised products." />
      ) : (
        <div className="overflow-x-auto rounded-lg border scroll-area-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="text-left font-medium px-3 py-2">Product</th><th className="text-left font-medium px-3 py-2">Serial</th><th className="text-left font-medium px-3 py-2">Customer</th><th className="text-left font-medium px-3 py-2">Warranty until</th><th className="text-left font-medium px-3 py-2">Status</th></tr></thead>
            <tbody>
              {units.slice(0, 50).map((u: any) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.productName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{u.serialNo}</td>
                  <td className="px-3 py-2">{u.customerName ?? "—"}</td>
                  <td className="px-3 py-2">{u.warrantyEnd ? new Date(u.warrantyEnd).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-3 py-2">{u.inWarranty ? <span className="text-xs text-emerald-600">Active</span> : <span className="text-xs text-red-600">Expired</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
