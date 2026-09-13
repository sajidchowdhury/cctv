/**
 * PageHeader — consistent page title + optional action slot (doc §6:
 * "one primary action per screen").
 */
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
