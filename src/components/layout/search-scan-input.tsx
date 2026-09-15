"use client";

import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * SearchScanInput — type a few letters of name/model OR scan a barcode/serial
 * for an instant match (doc §5.2 "smart product search").
 *
 * Keyboard-first; the scan icon hints at barcode-scanner support.
 * Placeholder is customizable per screen.
 */
export function SearchScanInput({
  value,
  onChange,
  placeholder = "Search or scan name / model / serial…",
  className,
  autoFocus,
  onEnter,
  onKeyDownCapture,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  onKeyDownCapture?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        onKeyDownCapture={onKeyDownCapture}
        placeholder={placeholder}
        className="pl-9 pr-10 h-11"
        aria-label="Search or scan"
      />
      <ScanLine
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
