"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * DateRangePicker — reusable from/to date inputs + quick presets.
 */
export function DateRangePicker({
  from, to, onFromChange, onToChange, onApply,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
}) {
  function setPreset(preset: "today" | "thisMonth" | "last30") {
    const now = new Date();
    if (preset === "today") {
      const d = now.toISOString().slice(0, 10);
      onFromChange(d); onToChange(d);
    } else if (preset === "thisMonth") {
      onFromChange(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      onToChange(now.toISOString().slice(0, 10));
    } else {
      onFromChange(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      onToChange(now.toISOString().slice(0, 10));
    }
    setTimeout(onApply, 50);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-end">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-40" />
      </div>
      <Button size="sm" onClick={onApply}>Apply</Button>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setPreset("today")}>Today</Button>
        <Button size="sm" variant="ghost" onClick={() => setPreset("thisMonth")}>This month</Button>
        <Button size="sm" variant="ghost" onClick={() => setPreset("last30")}>30d</Button>
      </div>
    </div>
  );
}
