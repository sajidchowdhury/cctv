"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { Boxes } from "lucide-react";
export default function ProductsPage() {
  return <ModuleComingSoon title="Products" icon={Boxes} session="S06" description="Catalogue, categories, units, SKU/barcode, low-stock threshold." />;
}
