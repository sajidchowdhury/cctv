"use client";
import { ModuleComingSoon } from "@/components/layout/module-coming-soon";
import { Bell } from "lucide-react";
export default function RemindersPage() {
  return <ModuleComingSoon title="Reminders" icon={Bell} session="S22" description="Unified reminder engine + SMS gateway (incl. subscription bill)." />;
}
