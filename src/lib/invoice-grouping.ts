/**
 * Invoice item grouping — shared between the on-screen invoice card
 * (src/app/(app)/sales/[id]/page.tsx) and the print page
 * (src/app/print/sales/[id]/page.tsx).
 *
 * Why shared?
 *   - Both pages had a copy of the same grouping logic (Map<string, GroupedItem>
 *     keyed by product, accumulating serials + qty + lineTotal).
 *   - Phase 2 changes the table structure (warranty column, item layout) —
 *     having one source of truth means the change happens in one place.
 *
 * SaleItem shape (from /api/sales/[id]):
 *   {
 *     id, saleId, productId, inventoryUnitId, lineType: "PRODUCT" | "SERVICE",
 *     description, qty, unitPrice, discount, lineTotal, warrantyMonths,
 *     product?: { id, name, model, sku },
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
};

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
 * Returns an array of GroupedItem, preserving insertion order.
 */
export function groupInvoiceItems(items: any[]): GroupedItem[] {
  const groups = new Map<string, GroupedItem>();

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
      existing.totalQty += 1; // each serialised SaleItem is qty=1
      existing.lineTotal += it.lineTotal;
    } else {
      groups.set(key, {
        key,
        productId: it.productId ?? null,
        productName: it.product?.name ?? it.description ?? "Product",
        model: it.product?.model ?? null,
        isSerialised: true,
        lineType: "PRODUCT",
        description: it.description ?? "",
        serials: it.inventoryUnit?.serialNo ? [it.inventoryUnit.serialNo] : [],
        totalQty: 1,
        unitPrice: it.unitPrice,
        discount: it.discount,
        lineTotal: it.lineTotal,
      });
    }
  }

  return Array.from(groups.values());
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
