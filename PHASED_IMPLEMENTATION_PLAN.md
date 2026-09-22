# Phased Implementation Plan — 10 Feature Updates

> **Status**: Planning document only. No code has been written yet.
> **Approach**: 10 features broken into 6 phases. Each phase is independently shippable — deploy after each phase so the user can test incrementally without waiting for the whole batch.
> **Reference invoice template**: `BMDINV2026017730.pdf` (BM Dubai Digital Technology) — drives the invoice format change in Phase 2.

---

## Table of Contents

| Phase | Features Covered | Estimated Effort | Risk |
|-------|------------------|-------------------|------|
| Phase 1 — Pre-work | Shared invoice component extraction | 1 session | Low |
| Phase 2 — Invoice format | #1 (warranty + remove per-item disc) + #5 (item layout: name → model → serial, no separate serial column) | 1 session | Medium |
| Phase 3 — Purchase UX | #6 (remove per-item disc) + #9 (last purchase rate display) | 1 session | Low |
| Phase 4 — RMA auto-detect | #7 (auto-fill customer/vendor from serial) | 1 session | Medium |
| Phase 5 — Reports cleanup | #2 (category search) + #3 (remove product links everywhere) + #8 (new customer-product-history report) | 2 sessions | Low |
| Phase 6 — Customer UX | #4 (customer search in sales) + #10 (walk-in vs regular toggle) | 1 session | Medium |

**Total**: ~7 sessions. Deploy after each phase.

---

## Phase 1 — Pre-work: Extract Shared Invoice Component

### Why this phase first

The invoice markup is currently duplicated between two files:
- `src/app/(app)/sales/[id]/page.tsx` (on-screen invoice card)
- `src/app/print/sales/[id]/page.tsx` (bare print page)

Both files have a `// NOTE: invoice markup is duplicated` comment warning future maintainers. Phase 2 changes the table structure (warranty column, layout change). Doing that change in two places risks drift. So we extract first.

### Tasks

1. **Create `src/components/invoice/invoice-document.tsx`**
   - A pure presentational component that takes `sale`, `profile`, and optional `printMode: boolean` prop.
   - Contains the header image / default header, bill-to row, items table, totals, footer.
   - When `printMode=true`, uses inline styles (current print page behavior).
   - When `printMode=false`, uses Tailwind classes (current sales detail page behavior).

2. **Refactor `src/app/print/sales/[id]/page.tsx`**
   - Replace the inline invoice markup with `<InvoiceDocument sale={sale} profile={profile} printMode />`.
   - Keep the auto-print `useEffect` + page wrapper.

3. **Refactor `src/app/(app)/sales/[id]/page.tsx`**
   - Replace the invoice Card content with `<InvoiceDocument sale={sale} profile={profile} />`.
   - Keep the action buttons (Print, Warranty card, SMS, Edit, Delete) + stat cards + quotation link.

4. **Move `groupedItems` logic to `src/lib/invoice-grouping.ts`**
   - Export `groupInvoiceItems(items: SaleItem[]): GroupedItem[]`.
   - Both pages import this. Single source of truth.

### Verification

- Open any sale at `/cctv/sales/<id>` → invoice should render identically to before.
- Click Print → print page renders identically to before.
- No visual changes — pure refactor.

### Commit

```
refactor: extract shared InvoiceDocument component + grouping util

Pre-work for Phase 2. Invoice markup was duplicated between
sales/[id]/page.tsx and print/sales/[id]/page.tsx. Extracting now
so Phase 2 (warranty column + layout change) only touches one file.
```

---

## Phase 2 — Invoice Format Overhaul (Features #1 + #5)

### What the user wants

Looking at the reference PDF (`BMDINV2026017730.pdf`), the invoice item format is:

```
SL | Product Description                                | Warranty | Qty | UoM | Unit Price | Amount
1  | HIKVISION MONITOR 21.5 INCH                       | 1 YEAR   | 1.00 | PCS | 8,300.00    | 8,300.00
   | DS-D5022F2-CBD, I YEAR FHD1920X1080, IPS, E-LED    |          |     |     |             |
   | VGA & HDMI, 100HZ, 1MS, BLACK                     |          |     |     |             |
   | S/N: 30192995990                                   |          |     |     |             |
2  | JVCO 32 INCH 32DF1CS VOICE-CONTROL SMART LED TV    | 3 YEARS  | 1.00 | PCS | 17,000.00   | 17,000.00
   | S/N: BM0303                                        |          |     |     |             |
```

Key observations:
- **Product name** is the bold first line (e.g. "HIKVISION MONITOR 21.5 INCH")
- **Model / description** is the second line (e.g. "DS-D5022F2-CBD, I YEAR FHD1920X1080...")
- **Serial number** is shown inline as `S/N: 30192995990` — NO separate Serials column
- **Warranty** has its own column (e.g. "1 YEAR", "3 YEARS")
- **No per-item discount column** — only invoice-level discount at the bottom
- Columns: SL | Product Description | Warranty | Qty | UoM | Unit Price | Amount

### Tasks

#### 2.1 Add Warranty column to invoice table

Modify `GroupedItem` type in `src/lib/invoice-grouping.ts`:
```ts
type GroupedItem = {
  // ... existing fields
  warrantyMonths: number | null;  // from SaleItem.warrantyMonths or InventoryUnit.warrantyEnd
  warrantyLabel: string;          // "1 YEAR", "3 YEARS", "—"
};
```

Logic:
- For serialised items: warranty comes from `InventoryUnit.warrantyEnd` → compute months remaining, or use `SaleItem.warrantyMonths` if stored.
- For non-serialised: use `SaleItem.warrantyMonths`.
- Format: `warrantyMonths === 12 ? "1 YEAR" : warrantyMonths === 24 ? "2 YEARS" : \`${warrantyMonths} MONTHS\``.
- If `warrantyMonths === 0` or `null` → show `—`.

#### 2.2 Change item layout — name, model, serial stacked

Replace the current 2-column "Item + Serials" layout with a single "Product Description" column that stacks:
1. **Product name** (bold) — e.g. "HIKVISION MONITOR 21.5 INCH"
2. **Model / description** (smaller, gray) — e.g. "DS-D5022F2-CBD, I YEAR FHD1920X1080..."
3. **Serial number** (mono, smaller) — e.g. "S/N: 30192995990" (one per line if multiple)

For multiple serials on the same product (e.g. 3 cameras of the same model):
```
1  | HIKVISION CAMERA DS-2CE1AD0T-IR                   | 1 YEAR   | 3.00 | PCS | 1,200.00    | 3,600.00
   | S/N: ABC123
   | S/N: ABC124
   | S/N: ABC125
```

#### 2.3 Remove per-item discount column

Remove the "Disc %" column from `<thead>` and `<tbody>`. The `SaleItem.discount` field stays in the DB (for backward compat) but is not displayed. Invoice-level discount at the bottom (already exists) handles all discount display.

#### 2.4 Final column layout

| SL | Product Description | Warranty | Qty | UoM | Unit Price | Amount |

- **SL**: serial index (1, 2, 3...) — new, was implicit before
- **Product Description**: stacked name + model + serial(s)
- **Warranty**: "1 YEAR" / "3 YEARS" / "—"
- **Qty**: number (tabular-nums)
- **UoM**: PCS / BOX / ROLL — needs to come from `Product.unit.name` (already in schema)
- **Unit Price**: BDT formatted
- **Amount**: line total (qty × unit price, no per-line discount)

#### 2.5 Update both invoice renderers

Since Phase 1 extracted the shared component, this change happens in ONE place: `src/components/invoice/invoice-document.tsx`.

### Verification

- Open any sale with serialised items → invoice shows stacked layout with S/N lines.
- Open any sale with non-serialised items → invoice shows name + model, no S/N line.
- Open any sale with service items → invoice shows description, no warranty.
- Print preview → same layout, prints correctly.
- Compare side-by-side with `BMDINV2026017730.pdf` — should match the style.

### Commit

```
feat: invoice format — warranty column, stacked item layout, remove per-item discount

Matches the reference invoice template (BMDINV2026017730.pdf).
- Product Description column now stacks: product name (bold) → model/description → S/N lines
- Removed separate Serials column
- Added Warranty column ("1 YEAR", "3 YEARS", "—")
- Removed per-item Disc % column (invoice-level discount at bottom remains)
- Added SL (serial index) column
- Added UoM column (from Product.unit.name)

Changes apply to both on-screen invoice and print page (shared component).
```

---

## Phase 3 — Purchase UX (Features #6 + #9)

### Feature #6: Remove product-wise discount during purchase

**Finding**: The purchase cart (`src/app/(app)/purchases/new/page.tsx`) currently has NO per-line discount field. The `CartLine` type doesn't include `discount`, and the cart grid shows Qty / Unit price / Sales price / Warranty — no discount input.

**Conclusion**: This feature is already satisfied. No code change needed. We'll note this in the changelog so the user knows it was checked.

### Feature #9: Last purchase rate display

**Goal**: When adding a product to the purchase cart, show the last purchase rate (per-unit price from the most recent PurchaseItem for that product) so the buyer knows what they paid last time.

### Tasks

#### 3.1 Extend `/api/products` GET response

File: `src/app/api/products/route.ts`

Add to the Prisma `include`:
```ts
purchaseItems: {
  orderBy: { createdAt: "desc" },
  take: 1,
  select: { unitPrice: true, createdAt: true },
},
```

Add to the response shape:
```ts
lastPurchaseRate: p.purchaseItems[0]?.unitPrice ?? null,
lastPurchaseDate: p.purchaseItems[0]?.createdAt ?? null,
```

This pattern is already used in 3 other places (`sales/search/route.ts`, `reports/stock-by-category/route.ts`, `reports/stock/page.tsx` API) — we're reusing the established pattern.

#### 3.2 Update Product type in purchases/new

File: `src/app/(app)/purchases/new/page.tsx`

Add to the `Product` type:
```ts
type Product = {
  // ... existing
  lastPurchaseRate: number | null;
  lastPurchaseDate: string | null;
};
```

#### 3.3 Display last purchase rate in the cart

Below the "Unit price" input in each cart line, add a small hint:
```tsx
{line.lastPurchaseRate !== null && (
  <p className="text-xs text-amber-600 dark:text-amber-400">
    Last purchase: {formatBDT(line.lastPurchaseRate)}
    {line.lastPurchaseDate && (
      <span className="text-muted-foreground ml-1">
        on {formatDate(line.lastPurchaseDate)}
      </span>
    )}
  </p>
)}
```

Color logic:
- If the entered unit price differs from last purchase rate by >10%, show amber.
- If matches, show green.
- If no last purchase (first time buying this product), show "First purchase" muted text.

### Verification

- Go to `/cctv/purchases/new` → add a product that has been purchased before → see "Last purchase: BDT X,XXX" hint below the unit price input.
- Add a product never purchased before → see "First purchase" hint.
- Change the unit price to differ from last → hint color changes to amber.

### Commit

```
feat: show last purchase rate in purchase cart

When adding a product to a purchase, the cart line now shows the last
purchase rate (per-unit price from the most recent PurchaseItem for
that product) below the unit price input. Helps the buyer know what
they paid last time and negotiate / catch price changes.

Feature #6 (remove product-wise discount in purchase) was already
satisfied — the purchase cart has no per-line discount field. No
change needed for that.
```

---

## Phase 4 — RMA Auto-Detect from Serial (Feature #7)

### Goal

When the user searches by serial number in the RMA form and selects a unit that was already sold, the system auto-fills:
- Customer name (from the sale that included this unit)
- Vendor/supplier name (from the purchase that brought this unit in)
- Sale date, sale price (read-only display)
- Purchase date, purchase price (read-only display)
- Warranty status (already computed — keep)

These fields become **read-only** (cannot be changed) because they're inferred from the serial's history.

### Tasks

#### 4.1 Extend `/api/inventory-units` response

File: `src/app/api/inventory-units/route.ts`

Currently returns: `id, serialNo, status, warrantyEnd, productId, productName, productModel, productSku`.

Add relations to the Prisma query:
```ts
include: {
  product: { select: { id: true, name: true, model: true, sku: true } },
  saleItems: {
    take: 1,
    orderBy: { createdAt: "desc" },
    include: {
      sale: {
        select: {
          id: true,
          invoiceNo: true,
          date: true,
          customerId: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  },
  purchaseItem: {
    include: {
      purchase: {
        select: {
          id: true,
          invoiceNo: true,
          date: true,
          supplierId: true,
          supplier: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  },
},
```

Add to response shape:
```ts
lastSale: u.saleItems[0]?.sale
  ? {
      saleId: u.saleItems[0].sale.id,
      invoiceNo: u.saleItems[0].sale.invoiceNo,
      date: u.saleItems[0].sale.date,
      customerId: u.saleItems[0].sale.customerId,
      customerName: u.saleItems[0].sale.customer?.name,
      customerPhone: u.saleItems[0].sale.customer?.phone,
    }
  : null,
purchase: u.purchaseItem?.purchase
  ? {
      purchaseId: u.purchaseItem.purchase.id,
      invoiceNo: u.purchaseItem.purchase.invoiceNo,
      date: u.purchaseItem.purchase.date,
      supplierId: u.purchaseItem.purchase.supplierId,
      supplierName: u.purchaseItem.purchase.supplier?.name,
      supplierPhone: u.purchaseItem.purchase.supplier?.phone,
      unitPrice: u.purchaseItem.unitPrice,
    }
  : null,
```

#### 4.2 Auto-fill + lock fields on serial selection

File: `src/app/(app)/rma/new/page.tsx`

In the inventory unit click handler:
```ts
function selectUnit(u: InventoryUnit) {
  setSelectedUnit(u);
  setSerialSearch("");
  // Auto-fill customer + supplier from the unit's history
  if (u.lastSale?.customerId) {
    setCustomerId(u.lastSale.customerId);
    setCustomerLocked(true);
  }
  if (u.purchase?.supplierId) {
    setSupplierId(u.purchase.supplierId);
    setSupplierLocked(true);
  }
}
```

Add state:
```ts
const [customerLocked, setCustomerLocked] = useState(false);
const [supplierLocked, setSupplierLocked] = useState(false);
```

#### 4.3 Show read-only info panel

Below the selected unit display, add a read-only info card:
```
┌─────────────────────────────────────────────┐
│ Auto-detected from serial history           │
├─────────────────────────────────────────────┤
│ Sold to:    SECURITY ZONE (01671790190)     │
│ Sale date:  20/09/2026                      │
│ Sale price: BDT 8,300                       │
│                                             │
│ Purchased from: HIKVISION BD LTD            │
│ Purchase date:  15/09/2026                  │
│ Purchase price: BDT 7,200                   │
│                                             │
│ ⚠ These fields are locked — inferred from   │
│   the serial's sale + purchase history.     │
└─────────────────────────────────────────────┘
```

#### 4.4 Make customer + supplier selects read-only when locked

When `customerLocked` / `supplierLocked` is true:
- Disable the `<Select>` component.
- Show a small lock icon + "auto-filled from serial" label.
- Add a "Unlock & override" button that lifts the lock (for edge cases where the auto-detection is wrong).

### Verification

- Create a sale for a serialised product (so the unit has a sale history).
- Go to `/cctv/rma/new` → search by that serial → select it.
- Customer + supplier selects auto-fill + lock.
- Info panel shows sale date, sale price, purchase date, purchase price.
- Click "Unlock & override" → can manually change customer/supplier.

### Commit

```
feat: RMA auto-detect customer/vendor from serial

When a serial is searched + selected in the RMA form, the system
auto-fills customer (from the sale that included this unit) and
vendor/supplier (from the purchase that brought this unit in). Both
fields become read-only with an info panel showing the full history
(sale date, sale price, purchase date, purchase price).

An "Unlock & override" button is available for edge cases where the
auto-detection is wrong (e.g. unit was resold, supplier changed).
```

---

## Phase 5 — Reports Cleanup (Features #2 + #3 + #8)

### Feature #2: Search filter in Stock by Category report

**Goal**: Add a search input so the user can search/filter categories by name before selecting them for the report.

### Tasks

#### 5.1 Add search input to the category filter panel

File: `src/app/(app)/reports/stock-by-category/page.tsx`

Add a `SearchScanInput` (or plain `<Input>`) at the top of the category multi-select panel:
```tsx
<Input
  placeholder="Search categories..."
  value={categorySearch}
  onChange={(e) => setCategorySearch(e.target.value)}
  className="mb-2"
/>
```

Filter the categories list:
```ts
const filteredCategories = useMemo(() => {
  if (!categorySearch.trim()) return categories;
  const q = categorySearch.toLowerCase();
  return categories.filter((c) => c.name.toLowerCase().includes(q));
}, [categories, categorySearch]);
```

### Feature #3: Remove product links from all reports

**Goal**: In all reports, product names should be plain text — not clickable links to `/products/[id]`. The user doesn't want to navigate away from the report.

### Tasks

#### 5.2 Grep for product links in reports

Search all files under `src/app/(app)/reports/` for `<Link href={`/products/` and `<Link href={\`/products/`.

Expected files to fix (based on exploration):
- `reports/stock-by-category/page.tsx` (2 links — desktop table + mobile card)
- `reports/stock/page.tsx` (1 link in DataTable column def)
- `reports/stock-by-model/page.tsx` (likely similar — verify with grep)
- `reports/product-movement/page.tsx` (likely — verify)
- `reports/sales-detailed/page.tsx` (likely — verify)
- `reports/purchase-detailed/page.tsx` (likely — verify)

#### 5.3 Replace each `<Link>` with plain text

Before:
```tsx
<Link href={`/products/${p.id}`} className="hover:underline">{p.name}</Link>
```

After:
```tsx
<span className="font-medium">{p.name}</span>
```

Also remove the `import Link from "next/link"` if it's no longer used in that file (clean up unused imports).

### Feature #8: New Customer-Product History report

**Goal**: A report where the user selects:
1. A customer (dropdown)
2. A product (dropdown — optionally filtered by what that customer has bought)
3. A date range (from / to)

And the report shows: date-wise sale history of that product to that customer — including sale date, invoice no, qty, unit price, line total.

### Tasks

#### 5.4 Add report to REPORTS array

File: `src/app/(app)/reports/page.tsx`

Add to the `REPORTS` array:
```ts
{
  href: "/reports/customer-product-history",
  title: "Customer Product History",
  desc: "See how many times a product was sold to a customer, at what price + qty.",
  icon: History,  // from lucide-react
  phase: "F6-S1",
},
```

Update the header count from "16 reports" to "17 reports".

#### 5.5 Create API route

File: `src/app/api/reports/customer-product-history/route.ts`

```ts
// GET /api/reports/customer-product-history?customerId=X&productId=Y&from=2026-01-01&to=2026-12-31
//
// Returns: {
//   sales: [{
//     saleId, invoiceNo, date, qty, unitPrice, lineTotal,
//     salesman: { name }
//   }],
//   summary: {
//     totalQty, totalAmount, saleCount,
//     firstSaleDate, lastSaleDate,
//     avgUnitPrice, minUnitPrice, maxUnitPrice
//   }
// }
```

Prisma query:
```ts
const saleItems = await db.saleItem.findMany({
  where: {
    tenantId,
    productId,
    sale: {
      customerId,
      deletedAt: null,
      date: { gte: from, lte: to },
    },
  },
  include: {
    sale: { select: { id: true, invoiceNo: true, date: true, salesman: { select: { name: true } } } },
  },
  orderBy: { sale: { date: "desc" } },
});
```

#### 5.6 Create report page

File: `src/app/(app)/reports/customer-product-history/page.tsx`

Layout:
```
┌─ PageHeader: Customer Product History ──────────────────┐
│                                                          │
│  [Customer: SEARCH + SELECT ▼]  [Product: SEARCH ▼]      │
│  [From date] [To date]  [Run report]                    │
│                                                          │
│  ┌─ Summary cards ─────────────────────────────────┐    │
│  │ Total sales: 5  Total qty: 12  Total: BDT 45,000│    │
│  │ Avg price: BDT 3,750  Min: BDT 3,000  Max: 4,500│    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ DataTable ─────────────────────────────────────┐    │
│  │ Date       | Invoice  | Qty | Unit  | Total | By  │    │
│  │ 20/09/2026 | INV-...  | 1   | 4,500 | 4,500 | MA │    │
│  │ 15/08/2026 | INV-...  | 2   | 4,000 | 8,000 | MA │    │
│  │ ...                                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Print] [Export CSV]                                   │
└──────────────────────────────────────────────────────────┘
```

- Customer dropdown: uses existing `/api/customers?q=` search pattern.
- Product dropdown: uses existing `/api/products?q=` or a new lightweight search.
- Date range: standard date inputs (or `DateRangePicker` if available).
- DataTable: standard shadcn table with columns Date / Invoice / Qty / Unit price / Total / Salesman.

### Verification

- Go to `/cctv/reports` → "17 reports" header.
- Click "Customer Product History" → filter form appears.
- Pick a customer + product + date range → click Run → see the sale history table.
- Pick a customer who hasn't bought a specific product → empty state.
- Go to Stock by Category → search box filters the category list.
- Go to any report → product names are plain text (not clickable).

### Commits (2 sessions)

**Session 1**:
```
feat: add search filter to stock-by-category report + remove product links from all reports

- Stock by Category: search input at top of category multi-select panel
- Removed <Link> wrapping product names in:
  * reports/stock-by-category/page.tsx (desktop + mobile)
  * reports/stock/page.tsx
  * reports/stock-by-model/page.tsx
  * reports/product-movement/page.tsx
  * reports/sales-detailed/page.tsx
  * reports/purchase-detailed/page.tsx
```

**Session 2**:
```
feat: new Customer Product History report

Select a customer + product + date range → see date-wise sale history
of that product to that customer, including invoice no, qty, unit
price, line total, and salesman. Summary cards show total sales count,
total qty, total amount, avg/min/max unit price.

Use case: "How many times did Customer X buy Product A, at what price,
and what quantity?"
```

---

## Phase 6 — Customer UX (Features #4 + #10)

### Feature #4: Customer search in sales

**Goal**: In the sales new page, replace the plain `<Select>` dropdown (which lists ALL customers) with a searchable customer picker — same pattern as the product search.

### Tasks

#### 6.1 Replace `<Select>` with search input + dropdown

File: `src/app/(app)/sales/new/page.tsx`

Replace the customer `<Select>` block with:
1. A `SearchScanInput` for typing customer name/phone.
2. A debounced fetch to `/api/customers?q=${q}` (300ms — same pattern as product search).
3. A dropdown of results (name + phone).
4. Clicking a result sets `customerId` + clears the search.
5. Selected customer shows as a chip / badge with an X to clear.

Keep the `InlineEntityCreator` button ("+ New customer") next to the search.

#### 6.2 Backend already supports search

`/api/customers?q=` already does `OR: [name contains, phone contains]` — no backend change needed.

### Feature #10: Walk-in vs Regular customer toggle

**Goal**: When the user clicks the "+ New customer" icon, a modal opens with a toggle: "Walk-in customer" vs "Regular customer". Both collect name + phone. The difference shows up in reports — walk-in customers can be filtered separately from regular customers.

### Tasks

#### 6.3 Add `WALK_IN` to customer type

File: `prisma/schema.prisma` — update the Customer.type comment:
```prisma
type String @default("RETAIL") // RETAIL | INSTALLER | WALK_IN
```

File: `src/app/api/customers/route.ts` — update Zod:
```ts
type: z.enum(["RETAIL", "INSTALLER", "WALK_IN"]).default("RETAIL"),
```

No DB migration needed (type is plain String, not a Prisma enum).

#### 6.4 Update InlineEntityCreator for customer

File: `src/app/(app)/sales/new/page.tsx`

Replace the current `InlineEntityCreator` usage with a custom Dialog that has:
1. A `ToggleGroup` / `Tabs` at the top: "Regular customer" | "Walk-in customer"
2. Name + Phone inputs (same for both)
3. When "Walk-in" is selected: hide the address field, set `type: "WALK_IN"` in the POST body.
4. When "Regular" is selected: show address field, set `type: "RETAIL"`.

The customer is created via the existing `POST /api/customers` endpoint — no new API needed.

#### 6.5 Add walk-in filter to customer ledger report

File: `src/app/(app)/reports/customer-ledger/page.tsx`

Add a filter dropdown:
- "All customers" (default)
- "Regular customers only" (type !== "WALK_IN")
- "Walk-in customers only" (type === "WALK_IN")
- Specific customer (existing behavior)

File: `src/app/api/reports/customer-ledger/route.ts`

Add `type` query param:
```ts
const typeFilter = url.searchParams.get("type");
// where: { ...(typeFilter === "WALK_IN" ? { type: "WALK_IN" } : typeFilter === "REGULAR" ? { NOT: { type: "WALK_IN" } } : {}) }
```

### Verification

- Go to `/cctv/sales/new` → customer picker is now a search input → type a name → results appear → click to select.
- Click "+ New customer" → modal opens with toggle → select "Walk-in" → enter name + phone → save → customer is created with `type: "WALK_IN"`.
- Select "Regular" → enter name + phone + address → save → `type: "RETAIL"`.
- Go to `/cctv/reports/customer-ledger` → filter by "Walk-in customers only" → see only walk-in transactions.
- Filter by "Regular customers only" → see only regular customer transactions.

### Commit

```
feat: searchable customer picker + walk-in vs regular customer toggle

Sales new page:
- Customer picker is now a debounced search input (was a plain Select
  that loaded all customers on mount). Type name or phone → see results.
- Click "+ New customer" → modal opens with toggle:
  * Regular customer: name + phone + address, type=RETAIL
  * Walk-in customer: name + phone only, type=WALK_IN

Reports:
- Customer Ledger report now has a type filter: All / Regular / Walk-in
- Walk-in customers can be filtered separately from regular customers.

Schema: added WALK_IN to the Customer.type enum (no migration needed —
type is a plain String column).
```

---

## Summary Table

| # | Feature | Phase | Sessions | Files Touched |
|---|---------|-------|----------|---------------|
| 1 | Warranty in invoice + remove per-item disc | Phase 2 | 1 | invoice-document.tsx (shared) |
| 2 | Search filter in stock-by-category | Phase 5 | 1 | reports/stock-by-category/page.tsx |
| 3 | Remove product links from reports | Phase 5 | 1 | 6 report pages (grep-driven) |
| 4 | Customer search in sales | Phase 6 | 1 | sales/new/page.tsx |
| 5 | Invoice item layout (name→model→serial stacked) | Phase 2 | 1 | invoice-document.tsx (shared) |
| 6 | Remove product-wise discount in purchase | Phase 3 | 0 | None (already satisfied) |
| 7 | RMA auto-detect from serial | Phase 4 | 1 | rma/new/page.tsx + api/inventory-units/route.ts |
| 8 | Customer-product-history report | Phase 5 | 1 | new report page + API route |
| 9 | Last purchase rate in purchase cart | Phase 3 | 1 | purchases/new/page.tsx + api/products/route.ts |
| 10 | Walk-in vs regular customer toggle | Phase 6 | 1 | sales/new/page.tsx + schema + customer-ledger report |

**Total**: 7 sessions across 6 phases.

---

## Deployment Strategy

After each phase:
1. `git pull origin main` on VPS
2. `bun run build`
3. `pm2 restart cctv`
4. Test the specific features changed in that phase
5. Move to next phase only after sign-off

If any phase introduces a regression, `git revert <commit>` and rework before proceeding.

---

## Risk Notes

- **Phase 1 (extraction)**: Pure refactor — risk of visual regression. Test both on-screen + print invoice before proceeding.
- **Phase 2 (invoice format)**: Touches the most-visible UI. Compare side-by-side with the reference PDF.
- **Phase 4 (RMA auto-detect)**: Extends the inventory-units API response. Check that existing callers (sales search, stock reports) don't break from the extra fields.
- **Phase 5 (new report)**: New route + API — low risk since it's additive.
- **Phase 6 (customer toggle)**: Adds a new customer type. Backward compatible (existing customers stay RETAIL).

---

## Out of Scope (Noted for Future)

- Extracting the invoice markup into a server-rendered PDF (currently HTML → browser print). Would enable email-attached PDFs.
- Walk-in customer ledger as a separate nav item (currently just a filter on the existing customer-ledger report).
- Bulk customer import (CSV) — not requested but would be useful for onboarding.
- Product unit (UoM) management UI — the schema has a `Unit` model but no admin UI for managing units. The invoice will show `unit.name` if set, otherwise blank.
