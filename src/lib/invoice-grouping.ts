/**
 * Invoice item grouping — shared between the on-screen invoice card
 * (src/app/(app)/sales/[id]/page.tsx) and the print page
 * (src/app/print/sales/[id]/page.tsx).
 *
 * Why shared?
 *   - Both pages had a copy of the same grouping logic (Map<string, GroupedItem>
 *     keyed by product, accumulating serials + qty + lineTotal).
 *   - Phase 2 changes the table structure (warranty column + new item layout) —
 *     having one source of truth means the change happens in one place.
 *
 * SaleItem shape (from /api/sales/[id]):
 *   {
 *     id, saleId, productId, inventoryUnitId, lineType: "PRODUCT" | "SERVICE",
 *     description, qty, unitPrice, discount, lineTotal, warrantyMonths,
 *     product?: { id, name, model, sku, unit?: { name } },
 *     inventoryUnit?: { id, serialNo, status, warrantyEnd },
 *   }
 */

export type GroupedItem = {
  key: string;
  productId: string | null;
  productName: string;
  model: string | null;
  isSerialised: boolean;
  lineType: string; // "PRODUCT" | "SERVICE"
  description: string;
  serials: string[];
  totalQty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  /** Warranty duration in months (0 if none). */
  warrantyMonths: number;
  /** Human-readable warranty label: "1 YEAR", "3 YEARS", "6 MONTHS", "—". */
  warrantyLabel: string;
  /** Unit of measure name (e.g. "PCS", "BOX", "ROLL"). null if not set. */
  unitName: string | null;
};

/**
 * Format a warranty duration (in months) as a human-readable label.
 *
 *   12 → "1 YEAR"
 *   24 → "2 YEARS"
 *   36 → "3 YEARS"
 *   6  → "6 MONTHS"
 *   0  → "—"
 *   18 → "18 MONTHS" (not 1.5 YEARS — keep it simple)
 */
export function formatWarranty(months: number): string {
  if (!months || months <= 0) return "—";
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 YEAR" : `${years} YEARS`;
  }
  return `${months} MONTHS`;
}

/**
 * Compute the warranty months for a sale item.
 *
 * - For serialised items: derive from inventoryUnit.warrantyEnd minus sale date
 *   (the warranty end is set at purchase time; we compute the duration here).
 * - For non-serialised items: use SaleItem.warrantyMonths directly.
 * - For service items: 0 (no warranty).
 *
 * `saleDate` is the sale's date (used to compute duration from warrantyEnd).
 */
function computeWarrantyMonths(it: any, saleDate: Date | string): number {
  if (it.lineType === "SERVICE") return 0;

  // Serialised: derive from inventoryUnit.warrantyEnd.
  if (it.inventoryUnit?.warrantyEnd) {
    const start = new Date(saleDate).getTime();
    const end = new Date(it.inventoryUnit.warrantyEnd).getTime();
    if (end <= start) return 0;
    // Convert milliseconds to months (30.44 days per month average).
    const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44));
    return Math.max(0, months);
  }

  // Non-serialised: use warrantyMonths from SaleItem (defaults to 0).
  return it.warrantyMonths ?? 0;
}

/**
 * Group sale items by product (or service-line) for invoice display.
 *
 * Grouping rules:
 *   - SERVICE lines: each is its own group (key: `svc-${it.id}`).
 *   - Non-serialised products: group by productId (key: `ns-${productId}`),
 *     accumulate qty + lineTotal.
 *   - Serialised products: group by productId (key: `s-${productId}`),
 *     accumulate serials (one per item, each item is qty=1) + lineTotal.
 *
 * Warranty is computed per group: for serialised items, takes the warranty
 * from the first item's inventoryUnit (they should all be the same product
 * with the same warranty window). For non-serialised, takes warrantyMonths
 * from the first SaleItem.
 *
 * @param items SaleItem[] from /api/sales/[id]
 * @param saleDate The sale's date — used to compute warranty duration from
 *   inventoryUnit.warrantyEnd. Pass `undefined` to skip warranty computation
 *   (will default to 0 / "—").
 */
export function groupInvoiceItems(items: any[], saleDate?: Date | string): GroupedItem[] {
  const groups = new Map<string, GroupedItem>();
  const sd = saleDate ?? new Date();

  for (const it of items) {
    // Service lines: each is its own group.
    if (it.lineType === "SERVICE") {
      const key = `svc-${it.id}`;
      groups.set(key, {
        key,
        productId: null,
        productName: it.description ?? "Service",
        model: null,
        isSerialised: false,
        lineType: "SERVICE",
        description: it.description ?? "",
        serials: [],
        totalQty: it.qty,
        unitPrice: it.unitPrice,
        discount: it.discount,
        lineTotal: it.lineTotal,
        warrantyMonths: 0,
        warrantyLabel: "—",
        unitName: null,
      });
      continue;
    }

    // Non-serialised products: group by productId (accumulate qty).
    if (!it.inventoryUnitId) {
      const key = `ns-${it.productId ?? it.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.totalQty += it.qty;
        existing.lineTotal += it.lineTotal;
      } else {
        const warrantyMonths = computeWarrantyMonths(it, sd);
        groups.set(key, {
          key,
          productId: it.productId ?? null,
          productName: it.product?.name ?? it.description ?? "Product",
          model: it.product?.model ?? null,
          isSerialised: false,
          lineType: "PRODUCT",
          description: it.description ?? "",
          serials: [],
          totalQty: it.qty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          lineTotal: it.lineTotal,
          warrantyMonths,
          warrantyLabel: formatWarranty(warrantyMonths),
          unitName: it.product?.unit?.name ?? null,
        });
      }
      continue;
    }

    // Serialised products: group by productId, collect serials.
    const key = `s-${it.productId ?? it.id}`;
    const existing = groups.get(key);
    if (existing) {
      if (it.inventoryUnit?.serialNo) {
        existing.serials.push(it.inventoryUnit.serialNo);
      }
      // Use it.qty instead of hardcoded 1 — the sales form allows the user
      // to set qty > 1 for a serialised line (e.g. qty=5 with 1 serial).
      // The SaleItem's lineTotal is computed as qty × unitPrice, so totalQty
      // must use the same qty to stay consistent with lineTotal.
      existing.totalQty += it.qty;
      existing.lineTotal += it.lineTotal;
    } else {
      const warrantyMonths = computeWarrantyMonths(it, sd);
      groups.set(key, {
        key,
        productId: it.productId ?? null,
        productName: it.product?.name ?? it.description ?? "Product",
        model: it.product?.model ?? null,
        isSerialised: true,
        lineType: "PRODUCT",
        description: it.description ?? "",
        serials: it.inventoryUnit?.serialNo ? [it.inventoryUnit.serialNo] : [],
        totalQty: it.qty,
        unitPrice: it.unitPrice,
        discount: it.discount,
        lineTotal: it.lineTotal,
        warrantyMonths,
        warrantyLabel: formatWarranty(warrantyMonths),
        unitName: it.product?.unit?.name ?? null,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Split an array of serials into groups of `size` (default 5) for compact
 * display on the invoice.
 *
 * Each chunk is joined with commas. The calling component renders each chunk
 * on its own line, with "S/N: " prefix only on the first chunk.
 *
 * Example:
 *   chunkSerials(["a", "b", "c", "d", "e", "f", "g"], 5)
 *   → ["a,b,c,d,e", "f,g"]
 *
 *   chunkSerials(["a", "b"], 5)
 *   → ["a,b"]
 *
 *   chunkSerials([], 5)
 *   → []
 */
export function chunkSerials(serials: string[], size = 5): string[] {
  if (serials.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < serials.length; i += size) {
    chunks.push(serials.slice(i, i + size).join(","));
  }
  return chunks;
}

/**
 * Split grouped items into pages for print pagination.
 *
 * If items.length <= perPage, returns a single page.
 * Otherwise chunks into perPage-sized pages.
 */
export function paginateItems(
  items: GroupedItem[],
  perPage: number
): GroupedItem[][] {
  if (items.length <= perPage) return [items];
  const pages: GroupedItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}
