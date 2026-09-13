# CCTV Inventory SaaS — Review Issues & Fix Plan

> **Created:** 2026-09-13
> **Source:** User review after completing all 25 sessions (S01–S25)
> **Purpose:** Track every issue raised + proposed solution, organized into fix phases and sessions
> **Rule:** No coding in this file — this is the planning document. We work through it session by session.

---

## Table of Contents

1. [Issue Summary](#issue-summary)
2. [Fix Phases Overview](#fix-phases-overview)
3. [Detailed Issues + Solutions](#detailed-issues--solutions)
4. [Session Plan](#session-plan)

---

## Issue Summary

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | Product Setup | No inline category/unit creation — user must go to another page | High |
| 2 | Purchase | Serial qty validation missing (qty 3 but 2 serials allowed) | High |
| 3 | Purchase | No auto-comma after serial scan | Medium |
| 4 | Purchase | Products without serial numbers have no solution | High |
| 5 | Purchase | No edit option after purchase (must update ledger) | High |
| 6 | Purchase | No inline supplier creation during purchase | High |
| 7 | Purchase | No edit option for suppliers | Medium |
| 8 | Sales | No edit/delete option (must handle stock + ledger) | Critical |
| 9 | Sales | Search doesn't work by serial number | High |
| 10 | Sales | Search results not organized (should show model + product + serials grouped) | High |
| 11 | Sales | No stock check (can add to cart even if stock=0) | Critical |
| 12 | Sales | Purchase price not shown (should be hidden with ***, shown on click) | Medium |
| 13 | Purchase | Serial uniqueness check not prominent enough | Medium |
| 14 | Sales | Selling serials not products — products without serial need auto-generation | High |
| 15 | Warranty | Serial search not working | High |
| 16 | Warranty | Should search by product + show full history (purchase + sale + warranty) | High |
| 17 | RMA | Created but not showing in list | High |
| 18 | Reminders | Saved but not showing (SMS API not linked?) | Medium |
| 19 | Reports | Many missing reports (see detailed list) | High |
| 20 | UI/UX | Desktop version not premium (select boxes broken, width issues) | High |
| 21 | Subscription | Payment number not configurable from admin | Medium |
| 22 | Subscription | Subscription amount not changeable from admin | Medium |

---

## Fix Phases Overview

| Phase | Name | Sessions | Focus |
|-------|------|----------|-------|
| F1 | Purchase & Stock Fixes | F1-S1 to F1-S3 | Serial validation, inline supplier, purchase edit, no-serial products |
| F2 | Sales & Cart Overhaul | F2-S1 to F2-S3 | Serial search, stock check, edit/delete, organized search results, PP visibility |
| F3 | Warranty & RMA Fixes | F3-S1 to F3-S2 | Warranty lookup by product + full history, RMA list fix |
| F4 | Reports Enhancement | F4-S1 to F4-S2 | All missing reports, professional print, date-range |
| F5 | UI/UX Desktop Polish | F5-S1 to F5-S2 | Desktop layout, select boxes, premium feel, width fixes |
| F6 | Admin & Subscription | F6-S1 | Configurable payment number + amount from admin panel |
| F7 | Reminders & Misc | F7-S1 | Reminder visibility fix, inline category/unit creation |

**Total: 7 phases, 14 fix sessions.**

---

## Detailed Issues + Solutions

### Issue 1: Product Setup — Inline Category/Unit Creation

**Problem:** When creating/editing a product, if the user needs a new category or unit, they must navigate to `/accounting/heads` or a separate page. This breaks the flow.

**Solution:**
- Add a "+ New" button next to the Category and Unit dropdowns on the product create/edit form
- Clicking "+ New" opens a small inline popover/modal (not a full page navigation) where the user types the name and clicks "Add"
- The new category/unit is created via API and immediately selected in the dropdown
- No page navigation required — everything happens on the same form

**Session:** F7-S1 (Reminders & Misc)

---

### Issue 2: Purchase — Serial Qty Validation

**Problem:** User can set qty=3 but only enter 2 serials (or 4 serials with qty=3). No enforcement.

**Solution:**
- When user enters serials (one per line in the textarea), auto-count them
- If serial count > qty: show red error "Serial count (4) exceeds qty (3). Remove 1 serial or increase qty."
- If serial count < qty: show amber hint "Qty is 3 but only 2 serials entered. Add 1 more or reduce qty."
- Auto-set qty = serial count when serials are entered (if qty field is empty or user hasn't manually overridden)
- Prevent save if serial count > qty (hard block, not just warning)

**Session:** F1-S1 (Purchase Serial & Qty Fixes)

---

### Issue 3: Purchase — Auto-Comma After Serial Scan

**Problem:** When scanning serials with a barcode scanner, there's no auto-comma. User has to manually separate them.

**Solution:**
- Barcode scanners typically send Enter (\n) or Tab after each scan
- Change the serial input from a textarea to a smart input that:
  - Detects Enter key → adds a comma + newline automatically
  - Detects Tab key → adds a comma + newline
  - Shows serials as tags/chips below the input (like email recipients)
  - Each serial appears as a removable chip: `[SN-001 ×] [SN-002 ×] [SN-003 ×]`
  - Scanning a duplicate serial shows a red border + "Duplicate serial" warning
- For paste: split by newline, comma, or semicolon — handle all delimiters

**Session:** F1-S1 (Purchase Serial & Qty Fixes)

---

### Issue 4: Purchase — Products Without Serial Numbers

**Problem:** Some products (cable rolls, screws, connectors) don't have individual serial numbers. Current system requires serials or leaves them blank, but there's no clear handling.

**Solution:**
- Add a "Serialised?" toggle on each product (stored on Product model: `isSerialised: Boolean @default(true)`)
- When adding a product to the purchase cart:
  - If `isSerialised = true`: show serial input (current behavior)
  - If `isSerialised = false`: hide serial input, show "Non-serialised item" label, qty-only tracking
- For non-serialised products: stock tracked via PurchaseItem.qty (sum of all purchase items − sum of all sale items)
- For serialised products: stock tracked via InventoryUnit count (current behavior)
- Product edit page: add the "Serialised?" toggle so owner can change it per product
- Default: cameras/DVRs/NVRs = serialised, cables/PSU/accessories = non-serialised (auto-suggest based on category)

**Session:** F1-S2 (Non-Serialised Products + Auto-Serial Generation)

---

### Issue 5: Purchase — No Edit Option After Purchase

**Problem:** Once a purchase is saved, there's no way to edit it. If the user made a mistake (wrong price, wrong serial, wrong supplier), they can't fix it.

**Solution:**
- Add a "Edit" button on the purchase detail page
- On edit: load the purchase items back into an editable cart (similar to the sales resume flow)
- Allow editing: supplier, invoice number, date, item prices, serials, payment mode, paid amount
- On save (PATCH transaction):
  - Compare old vs new items:
    - If serials changed: update/delete/create InventoryUnits accordingly
    - If prices changed: update PurchaseItems
    - If supplier changed: reverse old supplier balance change + apply new
    - If paid/due changed: update supplier currentBalance
  - All changes are transactional — ledger stays consistent
- Add a "Delete" button (soft delete) that:
  - Restores all inventory units to null (delete them)
  - Reverses supplier balance change
  - Marks purchase as deleted

**Session:** F1-S3 (Purchase Edit + Delete + Ledger Reversal)

---

### Issue 6: Purchase — No Inline Supplier Creation

**Problem:** During purchase, if the supplier isn't in the system, the user must leave the purchase page, go to `/suppliers/new`, create the supplier, come back, and re-select.

**Solution:**
- Add a "+ New supplier" option at the top of the supplier dropdown in the purchase form
- Clicking it opens a small inline form (popover/modal) with: name, phone, company, opening balance
- On submit: create the supplier via API + immediately select it in the dropdown
- No page navigation — the purchase form stays intact
- Same pattern for the sales form (customer creation)

**Session:** F1-S3 (Purchase Edit + Delete + Ledger Reversal) — combined with supplier inline creation

---

### Issue 7: Purchase — No Edit Option for Suppliers

**Problem:** Supplier detail page has an edit form, but it may not be working or visible enough.

**Solution:**
- Verify the supplier PATCH endpoint works (it was built in S07)
- Ensure the edit form on `/suppliers/[id]` is visible + functional
- Add a quick-edit button on the supplier list (inline edit of name/phone without navigating to detail)

**Session:** F5-S2 (Desktop UI Polish — Part 2)

---

### Issue 8: Sales — No Edit/Delete Option

**Problem:** Once a sale is saved, there's no way to edit or delete it. If the wrong serial was sold or the wrong price was entered, the user is stuck.

**Solution:**
- Add "Edit" button on sale detail page:
  - Only for non-held, non-quote-converted sales (or allow editing converted ones with a warning)
  - On edit: load sale items back into the cart (like the resume flow)
  - Allow editing: customer, items, prices, discount, payment mode, paid
  - On save (PATCH transaction):
    - For each changed serialised item:
      - Old serial → restore to IN_STOCK (un-sell)
      - New serial → mark SOLD (if different)
    - Update customer receivable (reverse old due, apply new due)
    - Update all SaleItems
  - All transactional — stock + ledger stay consistent
- Add "Delete" button (soft delete):
  - Restore all inventory units to IN_STOCK (un-sell all serials)
  - Reverse customer balance change (subtract the due)
  - Mark sale as deleted (soft delete via deletedAt)
  - Confirmation dialog: "This will restore all sold units to stock and reverse the customer's balance. Continue?"

**Session:** F2-S2 (Sales Edit + Delete + Stock/Ledger Reversal)

---

### Issue 9: Sales — Search Doesn't Work by Serial Number

**Problem:** The "Add items" search in the sales cart searches by product name/model/SKU but not by serial number. User should be able to type/scan a serial and see the matching product + its available serials.

**Solution:**
- Expand the search query to also search `InventoryUnit.serialNo` (WHERE status = IN_STOCK)
- When searching, show results in the organized format (see Issue 10)
- If the search matches a serial exactly, auto-select that serial for the cart line

**Session:** F2-S1 (Sales Search Overhaul + Stock Check)

---

### Issue 10: Sales — Search Results Not Organized

**Problem:** Search results show a flat list of products. User wants them organized by product with available serials listed underneath.

**Solution:**
- Change search results to show grouped cards:
```
DH-IPC-HFW2431T (Dahua 4MP Dome Camera)
  Available: 3 | Stock: ৳2,500 PP | Price: ৳3,200
  Serials: SN-001, SN-002, SN-003

DS-2CE16D0T (Hikvision 2MP Bullet Camera)
  Available: 2 | Stock: ৳2,000 PP | Price: ৳2,100
  Serials: SN-004, SN-005
```
- Each card is clickable → adds the product to the cart with the first available serial pre-selected
- User can click a specific serial to add that exact unit to the cart
- For non-serialised products: show "Non-serialised" instead of serials list, with available qty

**Session:** F2-S1 (Sales Search Overhaul + Stock Check)

---

### Issue 11: Sales — No Stock Check (Can Add to Cart Even If Stock=0)

**Problem:** User can add a product to the cart even if its stock is 0. This should be blocked.

**Solution:**
- In the search results, disable products with 0 stock (greyed out + "Out of stock" badge)
- If user somehow adds an out-of-stock product: show red error "This product is out of stock. Create a purchase first."
- For serialised products: only show serials that are IN_STOCK (already done in search, but enforce on cart add)
- For non-serialised products: check total qty available (sum of purchases − sum of sales) before allowing cart add
- API-side: the sales POST already blocks oversell for serialised units — extend to non-serialised (check qty available)

**Session:** F2-S1 (Sales Search Overhaul + Stock Check)

---

### Issue 12: Sales — Purchase Price Hidden (***)

**Problem:** Purchase price (cost) is not shown in the sales cart. Owner/Manager should see it for margin visibility, but it should be hidden by default.

**Solution:**
- In each cart line, add a "PP" field next to the unit price:
  - Default: shows `***` (hidden)
  - On click (or hover): reveals the actual purchase price (e.g., ৳2,500)
  - Role-gated: only OWNER and MANAGER can see/click; SALESMAN always sees `***`
  - Show margin: `Margin: ৳700 (22%)` when PP is revealed
- In the search results: show `PP: ***` with a click-to-reveal (same role gating)

**Session:** F2-S3 (Purchase Price Visibility + Margin Display)

---

### Issue 13: Purchase — Serial Uniqueness Check

**Problem:** The API already checks for duplicate serials (S08), but the UX doesn't warn the user before submit.

**Solution:**
- Real-time duplicate check in the serial input:
  - When typing/scanning a serial, check if it already exists in the DB (debounced API call)
  - If duplicate: show red border + "Serial SN-001 already exists (sold in INV-260913-123)"
  - Block save if any serial is a duplicate
- Also check for duplicates within the same purchase (same serial entered twice)

**Session:** F1-S1 (Purchase Serial & Qty Fixes)

---

### Issue 14: Sales — Selling Serials Not Products (Auto-Generation)

**Problem:** The system should sell by serial number. If a product doesn't have a serial (non-serialised), it can't be sold. Need auto-generation for products that should have serials but don't.

**Solution:**
- If product `isSerialised = true`:
  - Sale requires selecting a specific serial (from available IN_STOCK units)
  - Can't sell without a serial — the search shows available serials to pick from
- If product `isSerialised = false`:
  - Sale works by qty (no serial needed) — stock tracked via qty math
- If a serialised product somehow has no serial (data inconsistency):
  - Auto-generate a serial: `AUTO-{productId}-{timestamp}` on sale
  - This is a fallback — the purchase should have assigned serials

**Session:** F2-S1 (Sales Search Overhaul + Stock Check) — combined with serial-based selling

---

### Issue 15: Warranty Lookup — Serial Search Not Working

**Problem:** The warranty lookup page searches by serial, but the API may not be returning results correctly or the search isn't triggering.

**Solution:**
- Debug the warranty lookup API (`/api/warranty/lookup?serial=X`):
  - Verify it queries `InventoryUnit` WHERE `serialNo CONTAINS X` AND `status = SOLD`
  - Check if the search is case-sensitive (should be case-insensitive)
  - Add logging to see what's being queried
- Fix the search trigger (ensure Enter key + button both work)
- If no results: show "No sold unit found for serial '{query}'"

**Session:** F3-S1 (Warranty Lookup Fix + Product History)

---

### Issue 16: Warranty — Search by Product + Show Full History

**Problem:** User wants to search by product name (not just serial) and see the full history: purchase details, sale details, warranty details.

**Solution:**
- Expand the warranty lookup to accept both serial AND product name search
- For each matching unit, show a timeline card:
```
Product: Dahua 4MP Dome Camera (DH-IPC-HFW2431T)
Serial: SN-001

Purchase:
  Invoice: PUR-260913-001 | Date: 13 Sep 2026
  Supplier: Dahua Distributor BD
  Purchase Price: ৳2,500 | Warranty: 12 months

Sale:
  Invoice: INV-260913-123 | Date: 13 Sep 2026
  Customer: Rahman Electronics
  Sales Price: ৳3,200

Warranty:
  Status: Active (expires 13 Sep 2027)
  Days remaining: 365

RMA:
  No RMA records

Service Tickets:
  No service tickets
```
- If no warranty: show "Warranty: Not applicable"
- If no sale: show "Not yet sold"
- If no purchase: show "Purchase data not found"

**Session:** F3-S1 (Warranty Lookup Fix + Product History)

---

### Issue 17: RMA — Created But Not Showing in List

**Problem:** RMA tickets are created successfully but don't appear in the list.

**Solution:**
- Debug the RMA list API (`GET /api/rma`):
  - Check if the tenant extension is filtering correctly (tenant_id injection)
  - Check if the `deletedAt: null` filter is applied correctly
  - Add logging to see what's returned
- Verify the RMA list page is fetching from the correct endpoint
- Check for any error in the browser console when loading `/rma`
- The RMA report page (`/reports/rma-status`) should also show the same data

**Session:** F3-S2 (RMA List Fix + Reminder Visibility)

---

### Issue 18: Reminders — Saved But Not Showing

**Problem:** Reminders are saved via the API but don't appear in the list or the dashboard widget.

**Solution:**
- Debug the reminders list API (`GET /api/reminders`):
  - Check if the `withTenant` guard is blocking (subscription status)
  - Check if `active: true` filter is hiding saved-but-inactive reminders
  - Add a "Show inactive" toggle (already exists in the UI — verify it works)
- Verify the dashboard due-today widget fetches correctly
- The reminder worker logs dispatches to console — check dev.log for `[reminder]` entries
- If the issue is SMS not sending: that's expected (ConsoleNotifier logs to stdout, not real SMS). The reminder IS dispatched — it's just not visible in the UI. Add a "dispatched" log table or notification badge.
- Solution: create a `ReminderLog` model that records each dispatch (timestamp, channel, status) so the user can see "Reminder X was sent on {date}"

**Session:** F3-S2 (RMA List Fix + Reminder Visibility)

---

### Issue 19: Missing Reports

**Problem:** Many reports are missing or incomplete. User wants a comprehensive, professional report suite.

**Missing/Needed Reports:**

| Report | Status | What's Needed |
|--------|--------|-------------|
| Cash Book | Exists (S15) but basic | Enhance: better layout, running balance per entry, print-friendly |
| Product Movement | Missing | New: show all IN/OUT movements per product (purchases in, sales out, RMA, adjustments) with running stock balance |
| Customer Ledger | Exists (S14) but not standalone | Create standalone report page with date range + print |
| Supplier Ledger | Exists (S07) but not standalone | Create standalone report page with date range + print |
| Product Stock by Category | Missing | New: group stock by category, show qty + value per category, drill-down to products |
| Product Stock by Model | Missing | New: group stock by model within a product, show serial-level breakdown |
| Invoice-wise Sales Report (summary) | Exists (S18) | Verify it has invoice-level rows with totals |
| Invoice-wise Sales Report (detailed) | Missing | New: each invoice expanded to show line items (product, serial, qty, price, discount) |
| Purchase Report (summary) | Exists (S18) | Verify it has invoice-level rows with totals |
| Purchase Report (detailed) | Missing | New: each purchase expanded to show line items |
| Profit/Loss (detailed) | Exists (S18) but basic | Enhance: show cost breakdown per item, margin per serial |

**Requirements for all reports:**
- Date range picker (from/to)
- Professional printable layout (print CSS, page breaks, headers/footers)
- CSV export
- Summary cards at top (totals)
- Responsive: works on mobile (card layout) + desktop (table layout)
- Filter by: date range, party (customer/supplier), product, category

**Session:** F4-S1 (Report Suite — Part 1) + F4-S2 (Report Suite — Part 2)

---

### Issue 20: Desktop UI Not Premium

**Problem:** The desktop layout has issues: select boxes look broken, total width seems off, doesn't feel premium.

**Specific Issues:**
- Select dropdowns (shadcn/ui Select) may be too narrow or have inconsistent styling
- Content area may not use full available width on large screens
- Cards/tables may have inconsistent padding/spacing
- The sidebar may be too narrow or too wide
- Overall typography/hierarchy may not feel polished

**Solution:**
- Audit all pages at 1280px, 1440px, 1920px widths
- Fix Select component: ensure consistent width (min-w), proper dropdown styling
- Fix content max-width: use `max-w-7xl` (1280px) or `max-w-screen-2xl` for data-heavy pages
- Standardize card padding: `p-6` for content, `gap-6` for spacing
- Improve table styling: sticky headers, proper column widths, hover states
- Add transitions/animations for premium feel (framer-motion page transitions)
- Audit all form layouts: consistent label/input alignment, grid spacing
- Fix mobile bottom nav overlapping content on desktop (should be hidden on md+)

**Session:** F5-S1 (Desktop UI Polish — Part 1) + F5-S2 (Desktop UI Polish — Part 2)

---

### Issue 21: Subscription — Payment Number Not Configurable

**Problem:** The bKash/Nagad/Bank number that users pay to is hardcoded or not shown. Admin should be able to set/change it from the admin panel.

**Solution:**
- Add a `paymentInstructions` field to the Tenant model (or a global Settings table)
- Admin panel: add a "Payment Settings" section where admin enters:
  - bKash number
  - Nagad number
  - Bank account details
  - Monthly fee amount (see Issue 22)
- The `/payment` page reads these settings and displays them to the user
- When admin changes the number, all future payment submissions show the new number

**Session:** F6-S1 (Admin Panel — Payment Settings)

---

### Issue 22: Subscription — Amount Not Changeable

**Problem:** The subscription amount (BDT 500/month) is hardcoded. Admin should be able to change it.

**Solution:**
- Add a `monthlyFee` field to a global Settings table (or Tenant model for per-tenant pricing)
- Admin panel: "Payment Settings" → "Monthly Fee" input (default 500)
- The `/payment` page displays the current fee
- The subscription lifecycle uses this fee amount for verification
- The signup page mentions the current fee

**Session:** F6-S1 (Admin Panel — Payment Settings)

---

## Session Plan

### Phase F1: Purchase & Stock Fixes (3 sessions)

#### F1-S1: Purchase Serial & Qty Fixes ✅ Complete
- Serial qty validation (count must match qty, hard block if exceeds)
- Auto-comma after serial scan (detect Enter/Tab, add delimiter)
- Serial chips/tags UI (removable, visual)
- Real-time duplicate serial check (debounced API)
- Duplicate within same purchase detection
- Products listed as serial tags with remove buttons

#### F1-S2: Non-Serialised Products + Auto-Serial Generation ✅ Complete
- Add `isSerialised` boolean to Product model
- Product edit page: "Serialised?" toggle
- Purchase cart: hide serial input for non-serialised products, show "Non-serialised item"
- Stock tracking: serialised = InventoryUnit count, non-serialised = PurchaseItem.qty sum − SaleItem.qty sum
- Auto-suggest based on category (cameras = serialised, cables = non-serialised)
- Products API: return `isSerialised` flag + compute onHand correctly for both types
- Stock summary: show both types correctly
- Sales cart: non-serialised products use qty-based line (no serial picker)
- Sales POST API: oversell check for non-serialised products (ΣPurchaseItem.qty − ΣSaleItem.qty ≥ requested qty)
- Shared `computeOnHand` + `computeOnHandBatch` helpers in `src/lib/onhand.ts` (used by 5 API endpoints)
- Backfill: existing Cable/PSU/Accessories products auto-set to `isSerialised=false`

#### F1-S3: Purchase Edit + Delete + Inline Supplier Creation ✅ Complete
- Purchase edit: load items back into cart, allow editing all fields
- Purchase delete: soft delete + restore inventory units + reverse supplier balance
- Ledger reversal on edit/delete (transactional)
- Inline supplier creation: "+ New supplier" in dropdown → popover form → create + select
- Supplier quick-edit from list (inline name/phone edit)
- Guards: block edit/delete if purchase has paid > 0 (downstream payment settlement); block delete if any units SOLD/IN_RMA
- Exposed invoiceNo + date fields (editable in edit-mode; auto-generated on create if blank)

---

### Phase F2: Sales & Cart Overhaul (3 sessions)

#### F2-S1: Sales Search Overhaul + Stock Check ✅ Complete
- Search by serial number (expand query to InventoryUnit.serialNo)
- Organized search results: grouped by product, showing available serials
- Stock check: disable out-of-stock products in search results
- Serial-based selling: for serialised products, user must pick a specific serial
- For non-serialised products: qty-based selling (no serial needed)
- Auto-select first available serial on product click

#### F2-S2: Sales Edit + Delete + Stock/Ledger Reversal ✅ Complete
- Sale edit: load items into cart, allow editing customer/items/prices/payment
- Sale delete: soft delete + restore all inventory units to IN_STOCK + reverse customer balance
- Transactional: stock + ledger stay consistent on edit/delete
- Confirmation dialog with clear warning about stock restoration

#### F2-S3: Purchase Price Visibility + Margin Display ✅ Complete
- PP field in cart lines: `***` by default, click to reveal (OWNER/MANAGER only)
- Margin calculation: `Margin: ৳700 (22%)` when PP revealed
- PP in search results: `PP: ***` with click-to-reveal
- SALESMAN role: always sees `***` (can't reveal)

---

### Phase F3: Warranty & RMA Fixes (2 sessions)

#### F3-S1: Warranty Lookup Fix + Product History ✅ Complete
- Fix serial search (case-insensitive, verify API returns results)
- Add product name search (not just serial)
- Show full product history timeline per unit:
  - Purchase details (invoice, date, supplier, price, warranty months)
  - Sale details (invoice, date, customer, price)
  - Warranty status (active/expired, end date, days remaining)
  - RMA records (if any)
  - Service tickets (if any)
- "Not applicable" for units without warranty
- "Not yet sold" for units in stock

#### F3-S2: RMA List Fix + Reminder Visibility ✅ Complete
- Debug RMA list API (check tenant filtering, deletedAt filter)
- Fix RMA list page (verify fetch endpoint, check console errors)
- Add ReminderLog model: records each reminder dispatch (timestamp, channel, status, message)
- Reminder list page: show dispatch history per reminder
- Dashboard: show "last dispatched" timestamp on reminder cards

---

### Phase F4: Reports Enhancement (2 sessions)

#### F4-S1: Report Suite — Part 1 (Core Reports) ✅ Complete
- Cash Book: enhanced layout with running balance, print CSS
- Product Movement: new report showing all IN/OUT per product with running stock
- Customer Ledger: standalone report page with date range + print
- Supplier Ledger: standalone report page with date range + print
- All with: date range picker, CSV export, professional printable layout, summary cards

#### F4-S2: Report Suite — Part 2 (Detailed + Category Reports) ✅ Complete
- Product Stock by Category: group by category, qty + value, drill-down
- Product Stock by Model: group by model within product, serial breakdown
- Invoice-wise Sales Report (detailed): each invoice expanded to line items
- Purchase Report (detailed): each purchase expanded to line items
- Profit/Loss (detailed): cost breakdown per item, margin per serial
- All with: date range, CSV export, professional print layout, responsive (mobile cards + desktop tables)

---

### Phase F5: UI/UX Desktop Polish (2 sessions)

#### F5-S1: Desktop UI Polish — Part 1 (Layout & Components) ✅ Complete
- Audit all pages at 1280px, 1440px, 1920px
- Fix Select component: consistent width, proper dropdown styling
- Fix content max-width: `max-w-7xl` for data-heavy pages
- Standardize card padding: `p-6`, gap-6`
- Improve table styling: sticky headers, column widths, hover states
- Fix sidebar width + spacing

#### F5-S2: Desktop UI Polish — Part 2 (Forms + Supplier Edit)
- Audit all form layouts: consistent label/input alignment, grid spacing
- Fix supplier edit form visibility + functionality
- Add transitions/animations for premium feel
- Fix mobile bottom nav overlap on desktop
- Typography/hierarchy polish across all pages

---

### Phase F6: Admin & Subscription (1 session)

#### F6-S1: Admin Panel — Payment Settings
- Create Settings table (or add fields to Tenant): `bkashNumber`, `nagadNumber`, `bankDetails`, `monthlyFee`
- Admin panel: "Payment Settings" section with editable fields
- `/payment` page: reads settings, displays current payment number + fee
- Subscription lifecycle: uses configurable `monthlyFee` for verification
- Signup page: mentions current fee from settings

---

### Phase F7: Reminders & Misc (1 session)

#### F7-S1: Inline Category/Unit Creation + Misc Fixes
- Inline category creation: "+ New" button next to category dropdown on product form
- Inline unit creation: "+ New" button next to unit dropdown on product form
- Popover/modal form: type name → create via API → select in dropdown
- Same pattern for customer creation during sales (inline)
- Any remaining misc fixes from the review

---

## Priority Order (Recommended)

1. **F2-S1** (Sales search + stock check) — Critical: users can sell out-of-stock items
2. **F2-S2** (Sales edit/delete) — Critical: no way to fix mistakes
3. **F1-S1** (Purchase serial validation) — High: data integrity issue
4. **F3-S1** (Warranty lookup fix) — High: broken feature
5. **F3-S2** (RMA list fix) — High: broken feature
6. **F1-S3** (Purchase edit + inline supplier) — High: missing core feature
7. **F1-S2** (Non-serialised products) — High: affects stock accuracy
8. **F5-S1** (Desktop UI) — High: premium feel
9. **F4-S1** (Reports Part 1) — High: missing business-critical reports
10. **F4-S2** (Reports Part 2) — High: detailed reports
11. **F2-S3** (PP visibility) — Medium: margin visibility
12. **F6-S1** (Admin payment settings) — Medium: configurability
13. **F7-S1** (Inline category/unit) — Medium: UX improvement
14. **F5-S2** (Desktop UI Part 2) — Medium: polish

---

*End of review issues & fix plan. Work through sessions in priority order.*
