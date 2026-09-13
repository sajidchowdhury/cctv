"use client";

/**
 * StickyActionBar — sticky bottom action bar on mobile (doc §6
 * "sticky bottom bar on mobile", "one primary action per screen").
 * Hidden on desktop where the action sits inline in the PageHeader.
 */
import { cn } from "@/lib/utils";

export function StickyActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "md:hidden fixed bottom-[64px] inset-x-0 z-30 border-t bg-card/95 backdrop-blur px-4 py-3 pb-safe",
        className
      )}
    >
      <div className="mx-auto max-w-5xl flex items-center gap-2">{children}</div>
    </div>
  );
}
