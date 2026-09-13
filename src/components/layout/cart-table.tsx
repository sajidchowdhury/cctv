"use client";

/**
 * CartTable — multi-row cart for Purchase + Sale + Quotation (doc §4.2, §4.3, §5.6).
 * Generic line type; caller renders each line via `renderLine`.
 *
 * Mobile: each row collapses to a card; Desktop: full table.
 * Shows running total in a sticky footer.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CartLine = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export function CartTable({
  lines,
  onAdd,
  onRemove,
  onQtyChange,
  onPriceChange,
  total,
  addLabel = "Add line",
  emptyLabel = "No lines yet. Add a product to start.",
}: {
  lines: CartLine[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onQtyChange?: (id: string, qty: number) => void;
  onPriceChange?: (id: string, price: number) => void;
  total: number;
  addLabel?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
          {emptyLabel}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-auto rounded-lg border scroll-area-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Item</th>
                  <th className="text-right font-medium px-4 py-2.5 w-24 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right font-medium px-4 py-2.5 w-32 text-xs uppercase tracking-wide">Unit Price</th>
                  <th className="text-right font-medium px-4 py-2.5 w-32 text-xs uppercase tracking-wide">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{l.description}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={l.qty}
                        onChange={(e) => onQtyChange?.(l.id, Number(e.target.value))}
                        className="w-20 text-right bg-transparent border-0 focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => onPriceChange?.(l.id, Number(e.target.value))}
                        className="w-28 text-right bg-transparent border-0 focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">৳{l.lineTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemove?.(l.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="sm:hidden space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{l.description}</span>
                  <button
                    type="button"
                    onClick={() => onRemove?.(l.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Qty</span>
                    <input
                      type="number"
                      step="0.01"
                      value={l.qty}
                      onChange={(e) => onQtyChange?.(l.id, Number(e.target.value))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Price</span>
                    <input
                      type="number"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => onPriceChange?.(l.id, Number(e.target.value))}
                      className="w-full border rounded px-2 py-1"
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-medium py-1">{l.lineTotal.toFixed(2)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between">
        {onAdd && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" /> {addLabel}
          </Button>
        )}
        <div className={cn("ml-auto text-right", !onAdd && "w-full")}>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">৳{total.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
