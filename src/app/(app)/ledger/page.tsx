"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { BookOpen } from "lucide-react";
export default function LedgerPage() {
  return <ModuleComingSoon title="Ledger" icon={BookOpen} session="S15" description="Income/expense, customer receipts, supplier payments, cash book." />;
}
