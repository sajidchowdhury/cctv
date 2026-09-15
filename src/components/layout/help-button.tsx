"use client";

/**
 * HelpButton — opens a right-side off-canvas with Bangla help.
 *
 * Phase F-S1: moved from a floating bottom-right button to an inline button
 * in the sidebar footer + mobile top bar (next to the theme toggle).
 * The floating button was covering the mobile bottom nav.
 *
 * Usage: <HelpButton /> renders just the trigger button. The Sheet (off-canvas)
 * is managed internally.
 */
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { HelpCircle, Lightbulb, ListChecks, Info } from "lucide-react";
import { findHelp } from "@/lib/help-content";

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const help = findHelp(pathname);

  return (
    <>
      {/* Inline trigger button — placed in sidebar footer / mobile top bar */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-9 w-9 shrink-0"
        aria-label="সাহায্য (Help)"
        title="সাহায্য — এই পেজ সম্পর্কে জানুন"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {/* Right-side off-canvas */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-primary/5">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-primary" />
              {help.title}
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed text-left">
              {help.description}
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-4 space-y-5">
            {/* How to section */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="h-4 w-4 text-primary shrink-0" />
                কিভাবে ব্যবহার করবেন
              </h3>
              <ol className="space-y-2">
                {help.howTo.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips section */}
            {help.tips && help.tips.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                  টিপস
                </h3>
                <ul className="space-y-1.5">
                  {help.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* General info */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                সাধারণ তথ্য
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CCTV InventoryOS — আপনার CCTV ব্যবসার সম্পূর্ণ ডিজিটাল সমাধান। বিক্রয়, ক্রয়, স্টক, হিসাব, ওয়ারেন্টি, RMA — সব এক জায়গায়।
              </p>
            </div>

            {/* Close button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              বন্ধ করুন (Close)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
