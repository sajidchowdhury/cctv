"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { ReceiptText } from "lucide-react";
export default function ReportsPage() {
  return <ModuleComingSoon title="Reports" icon={ReceiptText} session="S18" description="All 10 reports, printable PDF/Excel, date-range filters." />;
}
