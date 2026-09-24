"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarRange, CalendarDays } from "lucide-react";

/**
 * DateRangePicker — reusable from/to date inputs + quick presets.
 *
 * Layout: two date inputs side-by-side on one row (flex-1 each so they
 * share equal width + adapt to container), Apply button below on mobile
 * / inline on sm+. Quick presets (Today / This month / 30d) are small
 * pill buttons that sit in a row underneath.
 *
 * Designed to work inside a Card with py-4 space-y-3 layout (the
 * pattern used by sales report + sales-detailed report). No more
 * floating inputs — the layout is self-contained.
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
    <div className="space-y-2">
      {/* ── Date inputs + Apply ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">From</label>
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">To</label>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={onApply} className="h-9 w-full sm:w-auto">
            <CalendarRange className="mr-1 h-4 w-4" /> Apply
          </Button>
        </div>
      </div>

      {/* ── Quick presets ── small pill buttons, one row */}
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setPreset("today")} className="h-7 text-xs">
          <Calendar className="mr-1 h-3 w-3" /> Today
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPreset("thisMonth")} className="h-7 text-xs">
          <CalendarDays className="mr-1 h-3 w-3" /> This month
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPreset("last30")} className="h-7 text-xs">
          <CalendarDays className="mr-1 h-3 w-3" /> 30 days
        </Button>
      </div>
    </div>
  );
}
