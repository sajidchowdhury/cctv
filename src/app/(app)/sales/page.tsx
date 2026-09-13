"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { ShoppingCart } from "lucide-react";
export default function SalesPage() {
  return <ModuleComingSoon title="Sales" icon={ShoppingCart} session="S11" description="Cart-based sale, invoice PDF, due ledger, warranty card." />;
}
