"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { Wrench } from "lucide-react";
export default function RmaPage() {
  return <ModuleComingSoon title="Vendor RMA" icon={Wrench} session="S21" description="5-stage repair pipeline with timestamped history." />;
}
