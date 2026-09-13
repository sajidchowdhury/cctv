"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { PackagePlus } from "lucide-react";
export default function PurchasesPage() {
  return <ModuleComingSoon title="Purchase" icon={PackagePlus} session="S08" description="Multi-row cart + serial capture + supplier ledger update." />;
}
