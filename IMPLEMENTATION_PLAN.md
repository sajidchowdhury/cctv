# CCTV Inventory SaaS — Phase-by-Phase, Session-by-Session Implementation Plan

> **Source document:** `CCTV_Inventory_SaaS_TechnicalDoc_v1.2_2026-09-12.docx`
> **Plan version:** 1.0 (derived from Technical Doc v1.2)
> **Plan date:** 2026-09-12
> **Plan type:** Execution roadmap — converts the technical document into a sequenced, buildable plan
> **Goal:** After completing all phases/sessions below, the result is a **workable, multi-tenant SaaS software** for CCTV retail & service businesses in Bangladesh.

---

## 0. How to Read This Plan

- The plan is organised into **8 phases (P0 → P7)**, matching the Implementation Phases in §8 of the technical document.
- Each phase is broken into **Sessions**. A *Session* is one focused, buildable unit of work (roughly a half-day to a full day) that produces a shippable increment.
- Each Session contains: **Goal · Scope/Tasks · Database changes · API endpoints · UI screens · Acceptance criteria**.
- Sessions within a phase are sequential unless explicitly marked **(parallel)**.
- A phase is *done* when every one of its sessions passes its acceptance criteria.
- The project is *done* when all phases are done AND the **Definition of Done (§11)** checklist passes end-to-end on a mobile device.

### Conventions
- `tenant_id` is mandatory on every business table (soft-deleted via `deleted_at`).
- All money is BDT, 2 decimals.
- All dates are stored UTC; displayed in Asia/Dhaka.
- Every API route is tenant-scoped and role-guarded (Owner / Manager / Salesman / Accountant).
- Every UI screen is mobile-first (360px → 768px → 1280px+).

---

## 1. Executive Summary

The product is a **multi-tenant SaaS** that digitises a CCTV shop's daily paper workflow: purchase stock, sell it, collect cash, pay suppliers, follow up with clients, and track warranties + bill renewals. Tenancy is enforced by `tenant_id` + PostgreSQL Row-Level Security. Billing is a single flat plan — **BDT 500/month** — verified manually by an admin against a transaction ID, with a 25-day reminder / 10-day grace / day-40 lock-out lifecycle.

### Modules at a glance
1. Product Setup · 2. Purchase (cart + serial capture) · 3. Sales (cart + invoice + warranty card) · 4. Basic Accounting (cash-book) · 5. Customer Receipts & Supplier Payments · 6. Employee & Payroll · 7. Warranty Tracking · 8. Reports (10+) · 9. CRM Follow-up · 10. Reminders & Alerts · 11. Quotation & Project Estimation · 12. Vendor RMA Pipeline · 13. Subscription Lifecycle + Admin Verification Panel.

### Build order (phases)
| Phase | Name | Sessions | Target |
|-------|------|----------|--------|
| P0 | Foundation | S01–S05 | Repo, DB, auth, tenant isolation, UI shell, subscription lifecycle |
| P1 | Catalogue & Stock | S06–S09 | Products, suppliers, purchase + serials, inventory units |
| P2 | Sales & Invoicing | S10–S14 | Quotation → sale, cart, invoice PDF, warranty card |
| P3 | Accounting | S15–S16 | Income/expense, receipts, payments, cash book |
| P4 | Employees & Payroll | S17 | Employee setup + salary sheet |
| P5 | Reports | S18–S19 | All 10 reports + PDF/Excel export |
| P6 | CRM & Reminders | S20–S22 | Follow-up CRM, RMA pipeline, reminder engine + SMS |
| P7 | Polish & Launch | S23–S25 | Bangla i18n, dark mode, PWA, performance, beta |

**Total: 25 sessions across 8 phases.**

---

## 2. Environment & Stack Adaptation Notes

The technical document specifies a production stack (PostgreSQL 16, Redis 7 + BullMQ, Better-Auth/Clerk, S3/R2, Resend/Twilio). For development velocity in this build environment, the following adaptations apply **without changing the architecture** — production deployment swaps the adapters back to the document's stack.

| Layer | Document (production target) | Dev build (this environment) | Notes |
|-------|------------------------------|------------------------------|-------|
| Framework | Next.js 15 App Router | **Next.js 16 App Router** | Same model, newer version |
| Language | React 19 + TypeScript | **React 19 + TypeScript 5** | identical |
| UI | Tailwind 4 + shadcn/ui + Radix | **same** | identical |
| Forms/Tables | React Hook Form + TanStack Table v8 | **same** | identical |
| State/Data | TanStack Query + Zustand | **same** | identical |
| Backend | Next.js Route Handlers (tRPC optional) | **Next.js Route Handlers (REST)** | API-only, no server actions |
| ORM | Prisma 5 (PostgreSQL dialect) | **Prisma (SQLite client for dev)** | Schema portable to Postgres; `tenant_id` enforced in app layer + DB constraints |
| Database | PostgreSQL 16 (shared, RLS) | **SQLite (shared)** | RLS not native in SQLite → enforced via Prisma `tenant_id` middleware + unique constraints; migration path documented in P0 |
| Cache/Queue | Redis 7 + BullMQ | **In-memory queue (mini-service)** | BullMQ interface replicated by a small in-process/mini-service worker; swap to Redis in prod |
| Auth | Better-Auth / Clerk | **NextAuth.js v4 (RBAC)** | Same role model: Owner/Manager/Salesman/Accountant |
| Storage | S3 / R2 / MinIO | **local `uploads/` (S3-compatible interface)** | Abstraction layer so prod swap is one env var |
| Notifications | Resend (email) + Twilio/SSL Wireless SMS | **adapter stubs + console logging** | Real keys added at deploy |
| Reporting | react-pdf / server PDF + Recharts | **same** | identical |
| DevOps | Docker + Vercel/Render + GitHub Actions | **GitHub repo + local dev server** | CI added in P7 |

> **Architecture rule:** every adapter that differs from the doc must sit behind an interface (`IQueue`, `IStorage`, `INotifier`, `ITenantGuard`) so production can swap implementations with zero business-logic changes.

---

## 3. Phase P0 — Foundation (Sessions S01–S05)

**Phase goal:** A logged-in user lands on a tenant-scoped, mobile-first app shell with navigation, role-based access, tenant isolation, and the subscription lifecycle (reminder → grace → lock → verify) fully wired — even if no business modules exist yet.

### Session S01 — Project Bootstrap & Repo Structure
**Goal:** Establish a clean, typed, lint-clean Next.js 16 repo with the folder contract the rest of the plan depends on.

**Scope / Tasks:**
- Initialise Next.js 16 (App Router) + TypeScript 5 + Tailwind 4 + shadcn/ui (New York).
- Install: Prisma, TanStack Query, Zustand, React Hook Form, TanStack Table, Zod, next-themes, react-pdf, recharts, next-auth v4, lucide-react.
- Define folder contract:
  - `src/app/(app)/...` — authenticated tenant app routes
  - `src/app/(auth)/...` — login/register/payment screens
  - `src/app/api/...` — REST route handlers (tenant-scoped)
  - `src/app/admin/...` — super-admin control plane
  - `src/lib/` — db, auth, adapters (`queue`, `storage`, `notifier`), tenant-context
  - `src/components/ui/` — shadcn primitives
  - `src/components/` — domain components
  - `prisma/schema.prisma`
- Configure ESLint, TypeScript strict, path aliases (`@/`).
- Add `.env.example` (DATABASE_URL, NEXTAUTH_SECRET, STORAGE_DRIVER, SMS_PROVIDER, etc.).
- Add base README + this plan file committed to repo.

**Database changes:** none yet.

**API endpoints:** none.

**UI screens:** none (only a placeholder `/` confirming the server runs).

**Acceptance criteria:**
- ✅ `bun run lint` passes with zero errors.
- ✅ Dev server boots on port 3000; `/` renders a placeholder.
- ✅ Folder contract exists and is documented in README.

**Status:** ✅ Complete (S01)

---

### Session S02 — Database Schema, Prisma & Tenant Isolation
**Goal:** Land the full data model from §7 of the doc, with `tenant_id` everywhere, soft deletes, and an enforced tenant guard.

**Scope / Tasks:**
- Author `prisma/schema.prisma` with all entities: `tenants, users, products, inventory_units, suppliers, customers, employees, purchases, purchase_items, sales, sale_items, transactions, account_heads, service_tickets, follow_ups, reminders, salary_records, quotations, quotation_items, rma_tickets, rma_history, subscriptions, payment_verifications` (+ reference tables `categories, units`).
- Every business model carries `tenant_id`, `created_at`, `updated_at`, `deleted_at`.
- Add `@@unique([email])` on `users.email` and `tenants.owner_email` (1-email-per-account rule, §3.3).
- Add `@@index([tenant_id, ...])` on hot query paths.
- Create `src/lib/db.ts` exporting the Prisma client.
- Create `src/lib/tenant-context.ts`: resolves `tenant_id` from the session and attaches to request context.
- Implement a **Prisma extension / middleware** that auto-filters every read by `tenant_id` and injects it on create (replicates RLS behaviour on SQLite).
- Run `bun run db:push` and seed a dev tenant + owner user.

**Database changes:** full schema first migration.

**API endpoints:** none public yet.

**UI screens:** none.

**Acceptance criteria:**
- ✅ `prisma/schema.prisma` matches every table in doc §7.
- ✅ A cross-tenant read test (tenant A queries tenant B's rows) returns empty.
- ✅ `users.email` UNIQUE constraint rejects a duplicate signup at DB level.

**Status:** ✅ Complete (S02) — schema pushed, tenant-isolation extension verified by `bun run db:verify` (4/4 tests pass).

---

### Session S03 — Auth, RBAC & 1-Email-Per-Account
**Goal:** Tenant signup, login, role-based access control, and the email-uniqueness rules from §3.3.

**Scope / Tasks:**
- Configure NextAuth.js v4 (credentials + email verify).
- Roles enum: `OWNER | MANAGER | SALESMAN | ACCOUNTANT`; role guard middleware on API + page.
- Signup flow:
  - Reject if email already registered → show "login instead" link.
  - No free trial — account is created in `PENDING_ACTIVATION` status (no module access until first payment verified).
  - Email verification (OTP) on signup.
- Email-change flow: OTP to new address + 7-day cooldown on reuse of old email.
- Session includes `tenantId`, `userId`, `role`, `subscriptionStatus`.
- Locked-tenant gate: if `subscription.status === LOCKED`, every route except `/payment` redirects there.

**Database changes:** `users` role/status fields already in S02; add `email_verifications` table.

**API endpoints:**
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/change-email`

**UI screens:**
- `/login`, `/signup`, `/verify-email`, `/change-email`.

**Acceptance criteria:**
- ✅ Duplicate email signup is rejected with a clear message (409 EMAIL_TAKEN).
- ✅ A locked tenant cannot reach any business route (redirects to `/payment`).
- ✅ Role guard blocks a Salesman from accounting endpoints (403 Forbidden).

**Status:** ✅ Complete (S03) — verified via curl API tests + Agent Browser e2e (login → dashboard; locked → /payment).

---

### Session S04 — Base UI Shell, Navigation & Theme
**Goal:** The mobile-first app shell: bottom nav on mobile, sidebar on desktop, sticky footer, dark mode, BDT formatting.

**Scope / Tasks:**
- Layout: `min-h-screen flex flex-col` root; `header`, `main`, sticky `footer`.
- Mobile bottom nav: Home · Sales · Purchase · Ledger · More (thumb-reachable, ≥44px targets).
- Desktop: collapsible sidebar with the full module list.
- Sticky primary-action bar pattern ("one primary action per screen").
- `next-themes` dark mode (default light, calm blue accent `#1A73E8`).
- BDT currency util (`৳` symbol, 2 decimals).
- Empty-state component (illustration + single CTA).
- Reusable `DataTable` (TanStack Table), `CartTable`, `SearchScanInput`, `ConfirmDialog`, `Toaster`.
- Global search/scan input component (used across modules).

**Database changes:** none.

**API endpoints:** none.

**UI screens:**
- `/(app)/layout.tsx` — shell with nav + subscription banner slot.
- `/(app)/` — dashboard placeholder (widgets wired in later phases).

**Acceptance criteria:**
- ✅ On a 360px viewport, bottom nav is visible and thumb-reachable (5 slots, ≥56px targets).
- ✅ Footer sticks to bottom on short pages (footerBottom === viewportH), pushes down on long pages.
- ✅ Dark mode toggle persists across reloads (localStorage via next-themes).
- ✅ Calm blue accent #1A73E8 applied to primary + sidebar tokens (light + dark).
- ✅ Reusable components built: DataTable, CartTable, SearchScanInput, EmptyState, PageHeader, StickyActionBar, ConfirmDialog, ModuleComingSoon.

**Status:** ✅ Complete (S04) — verified via Agent Browser (mobile bottom nav, desktop sidebar, nav clicks, dark mode toggle, sticky footer on short page).

---

### Session S05 — Subscription Lifecycle, Payment Verification & Admin Panel
**Goal:** The full billing lifecycle from §3.2–§3.3.1: flat BDT 500/month, manual txn-ID verification, day-25 reminder / day-30 due / day-31–40 grace / day-41 lock, admin verify/reject queue.

**Scope / Tasks:**
- `subscriptions(tenant_id, plan, started_at, cycle_end, status, locked_at)` model + lifecycle state machine.
- `payment_verifications(tenant_id, method, txn_id, amount, paid_date, sender_number, status, verified_by, verified_at, rejection_reason)`.
- Tenant "Submit Payment" flow: form (method, txn ID, amount, date, sender number) → writes `PENDING` row.
- Lifecycle worker (in-memory/mini-service adapter behind `IQueue`):
  - Day 25 → reminder SMS + in-app banner.
  - Day 30 unpaid → status `GRACE`.
  - Day 31–40 → daily reminder + "X days to lockout" banner.
  - Day 41 → status `LOCKED`, `locked_at` set, all modules hidden, login lands on `/payment`.
- Super-admin control plane `/admin`:
  - Queue of `PENDING` verifications (tenant name, txn ID, amount, paid date, sender, age).
  - One-click **Verify** → `subscriptions.cycle_end += 30 days`, status `ACTIVE`, lock lifted.
  - **Reject** with mandatory reason → SMS user to retry.
  - Filter by status/date/tenant; daily digest SMS for submissions > 24h.
- Verify webhook action restores access within 60s (worker checks verified rows).
- First-activation rule: no module access until admin verifies the first payment.

**Database changes:** `subscriptions`, `payment_verifications` (already in S02; refine status enums).

**API endpoints:**
- `POST /api/billing/submit-payment` (tenant)
- `GET /api/billing/history` (tenant)
- `GET /api/admin/verifications` (super-admin)
- `POST /api/admin/verifications/:id/verify`
- `POST /api/admin/verifications/:id/reject`
- `POST /api/admin/tenants/:id/unlock` (manual grace extension)

**UI screens:**
- `/(app)/payment` — submit payment + history + renewal status banner.
- `/(app)/locked` — lockout screen (only screen reachable when locked).
- `/admin/verifications` — admin verification queue.

**Acceptance criteria:**
- ✅ A brand-new signup cannot reach any business module (only `/payment`).
- ✅ Admin verify extends `cycle_end` by exactly 30 days and lifts lock within 60s.
- ✅ Day-41 lock hides every module; data preserved, not deleted.
- ✅ Reject requires a reason; user receives retry SMS (adapter logs the SMS).
- ✅ Pending user can still submit a payment (withTenantAny guard).
- ✅ Admin login (shared auth, admin-credentials provider) → SUPER_ADMIN session.
- ✅ Lifecycle worker auto-advances ACTIVE→GRACE→LOCKED based on time.

**Status:** ✅ Complete (S05) — verified via curl API tests (full lifecycle) + Agent Browser (admin queue + tenant payment page on mobile).

---

## 4. Phase P1 — Catalogue & Stock (Sessions S06–S09)

**Phase goal:** The owner can define products, capture purchases with serials, and see live, accurate stock — the inventory spine of the business.

### Session S06 — Product Setup & Reference Tables
**Goal:** Full product master with categories, units, SKU/barcode, low-stock threshold.

**Scope / Tasks:**
- `products(name, category_id, model, sku, unit, safety_stock, image_url)` + `categories`, `units` (tenant-scoped, owner-addable).
- SKU auto-generation (`CAT-MODEL-###`) + printable barcode label.
- Low-stock rule: `on_hand_qty ≤ safety_stock` → alert event.
- Image upload via `IStorage` adapter.

**API endpoints:** `GET/POST/PATCH/DELETE /api/products`, `GET/POST /api/categories`, `GET/POST /api/units`, `GET /api/products/low-stock`.

**UI screens:** `/(app)/products` (list + filters), `/(app)/products/new`, `/(app)/products/[id]`, barcode label print.

**Acceptance criteria:** product with qty below safety stock surfaces a low-stock alert; barcode label prints.

**Status:** ✅ Complete (S06) — verified via curl API tests (create/list/low-stock/get) + Agent Browser (list with DataTable, detail with barcode label, edit form).

---

### Session S07 — Suppliers & Opening Balances
**Goal:** Supplier master feeding the purchase + supplier-payment ledgers.

**Scope / Tasks:**
- `suppliers(name, phone, company, opening_balance, current_balance)`.
- Supplier ledger view (purchases − payments + opening) — built on transactions later.

**API endpoints:** `GET/POST/PATCH/DELETE /api/suppliers`, `GET /api/suppliers/:id/ledger`.

**UI screens:** `/(app)/suppliers` list, `/(app)/suppliers/[id]` detail + ledger preview.

**Acceptance criteria:** supplier opening balance persists and shows in ledger summary.

**Status:** ✅ Complete (S07) — verified via curl API tests (create/list/detail/ledger) + Agent Browser (list with summary cards, detail with ledger table).

---

### Session S08 — Purchase Cart + Serial Capture + Inventory Units
**Goal:** Multi-row purchase with bulk-paste / barcode-scan serials, warranty per line, supplier ledger update, stock increase.

**Scope / Tasks:**
- `purchases` + `purchase_items(qty, unit_price, warranty_months, serials[])`.
- `inventory_units(product_id, serial_no, purchase_id, status, warranty_end)` auto-created on save.
- Cart UI: add product rows (search by name/model/scan), qty (fractional), purchase price, sales price (auto-fills product default), warranty months, serial bulk-paste.
- On Save: stock +qty, supplier payable += due, warranty timer starts per serial, units become saleable.
- Payment mode: Cash/Bank/bKash/Due → drives supplier payable.

**API endpoints:** `GET/POST /api/purchases`, `GET /api/purchases/[id]`, `GET /api/inventory-units` (with stock availability).

**UI screens:** `/(app)/purchases/new` (cart), `/(app)/purchases` list, `/(app)/purchases/[id]`.

**Acceptance criteria:** saving a purchase of 3 cameras + 1.5 rolls cable creates 3 serialised inventory_units + 1 fractional stock line + updates supplier due.

**Status:** ✅ Complete (S08) — verified via curl API tests (create with serials + fractional, inventory units, supplier balance, duplicate-serial rejection) + Agent Browser (list + cart render).

---

### Session S09 — Stock Summary & Low-Stock Alerts
**Goal:** Live stock visibility + low-stock push/SMS.

**Scope / Tasks:**
- Stock summary query (product-wise on-hand, value, low-stock flag).
- Low-stock event → `INotifier.notifyOwner()` + SMS.
- Dashboard "low stock" widget.

**API endpoints:** `GET /api/reports/stock-summary` (preview; full report in P5).

**UI screens:** `/(app)/` dashboard low-stock widget, `/(app)/products?filter=low-stock`.

**Acceptance criteria:** buying a product to below safety stock fires an owner SMS within 60s.

**Status:** ✅ Complete (S09) — verified via curl (stock-summary, low-stock silent + notify=1 SMS) + Agent Browser (dashboard stock widget, /stock page). SMS fires only with ?notify=1 (after a sale in S11), not on every dashboard read.

---

## 5. Phase P2 — Sales & Invoicing (Sessions S10–S14)

**Phase goal:** A salesman completes a full sale (quotation → cart → invoice → warranty card → due ledger) on a phone in under 3 minutes.

### Session S10 — Quotation & Project Estimation Builder
**Goal:** Pre-sale quote builder (§5.6) with product/labour/service lines, branded PDF, convert-to-sale.

**Scope / Tasks:**
- `quotations` + `quotation_items(line_type[PRODUCT/LABOR/SERVICE], qty, unit_price, discount)`.
- Quote No auto `QT-YYMMDD-001`; valid-until (default 15 days); status state machine (Draft/Sent/Accepted/Rejected/Expired/Converted).
- Branded quotation PDF (react-pdf) stored via `IStorage`.
- Convert-to-sale: copies line items into a Sales Invoice + stock reservation check; if out of stock → offer backorder Purchase.
- Auto follow-up reminder 3 days after `Sent` (no response).
- Win/Loss dashboard: conversion rate, avg quote value, top lost reasons.
- Duplicate-quote clone.

**API endpoints:** `GET/POST/PATCH /api/quotations`, `POST /api/quotations/:id/convert`, `POST /api/quotations/:id/duplicate`.

**UI screens:** `/(app)/quotations/new`, `/(app)/quotations`, `/(app)/quotations/[id]` (PDF preview + convert button), `/(app)/quotations/winloss`.

**Acceptance criteria:** accepted quote converts to a sale in one click with all line items/prices preserved; out-of-stock item flagged.

**Status:** ✅ Complete (S10) — verified via curl API tests (create with PRODUCT/LABOR/SERVICE lines, status workflow, convert with stock warning, duplicate, reject-requires-reason) + Agent Browser (list with stats, new quote form with labor/service buttons). PDF generation deferred to S25 (react-pdf); win/loss dashboard deferred to S18 (reports). Auto follow-up reminder deferred to S22 (reminder engine).

---

### Session S11 — Sales Cart, Invoice & Due Ledger
**Goal:** Cart-based sale (§4.3) with live stock, margin visibility (owner/manager), due ledger update, invoice PDF.

**Scope / Tasks:**
- `sales` + `sale_items(inventory_unit_id, qty, unit_price, discount, warranty_months)`.
- Invoice No `INV-YYMMDD-001`; customer (walk-in or named).
- Smart line add: type/scan serial/model/name → live stock + purchase rate (role-gated) + warranty.
- Qty fractional; sales rate editable; line + invoice discount.
- Payment mode + paid + due → drives customer receivable.
- On Save: stock decreases per serial/qty, customer receivable updates, invoice PDF generated + stored.

**API endpoints:** `GET/POST /api/sales`, `GET /api/sales/[id]`, `GET /api/sales/:id/invoice.pdf`.

**UI screens:** `/(app)/sales/new` (cart), `/(app)/sales` list, `/(app)/sales/[id]` (invoice view + PDF).

**Acceptance criteria:** sale of an oversold serial is blocked; due balance appears on customer ledger.

**Status:** ✅ Complete (S11) — verified via curl API tests (create with serialised unit + service line, inventory unit SOLD, on-hand decreased, oversell blocked 409, sale detail invoice) + Agent Browser (list + cart). Invoice PDF deferred to S25 (react-pdf); customer ledger view deferred to S14 (customer master).

---

### Session S12 — Warranty Card PDF + Customer SMS
**Goal:** Per-sold-serial warranty card + customer SMS (§5.1).

**Scope / Tasks:**
- Compute `warranty_end = sale_date + warranty_months`.
- Warranty card PDF (serial, product, customer, sale date, end date, code).
- SMS to customer with warranty code.
- 15/30-day pre-expiry reminder scheduling (wired to reminder engine in P6).
- Dashboard "upcoming warranty expiry" widget.

**API endpoints:** `GET /api/sales/:id/warranty-card.pdf`, `POST /api/sales/:id/send-warranty-sms`.

**UI screens:** `/(app)/warranty` (lookup by serial/phone), warranty card print.

**Acceptance criteria:** within 5s of sale completion, warranty PDF exists and SMS dispatched (adapter logs it).

**Status:** ✅ Complete (S12) — verified via curl API tests (PDF generates as valid %PDF binary, SMS dispatched via INotifier, warranty lookup by serial returns inWarranty status) + Agent Browser (warranty lookup page). 15/30-day pre-expiry reminder scheduling deferred to S22 (reminder engine). Dashboard upcoming-expiry widget deferred to S22.

---

### Session S13 — Held Invoices & Quick Service Lines
**Goal:** Cart ergonomics (§5.2): hold/resume, quick-add service line.

**Scope / Tasks:**
- Hold cart → persists draft (localStorage offline-tolerant + server draft).
- Resume held invoice; list of held drafts per salesman.
- Quick-add `Service` line (installation charge) without a product record.
- Default sales price auto-fill from product master; inline edit.

**API endpoints:** `POST /api/sales/draft`, `GET /api/sales/drafts`, `POST /api/sales/drafts/:id/resume`.

**UI screens:** held-drafts list, "Hold" button in sales cart.

**Acceptance criteria:** held cart survives a page reload (localStorage) and a server restart (server draft).

**Status:** ✅ Complete (S13) — verified via curl + Agent Browser (held sale created, resume URL loads items into cart with violet banner + Finalize button, localStorage draft key persists, Sales list shows Resume button for held items). S11 already implemented isHeld sales + PATCH finalize + service lines + default price auto-fill; S13 adds the resume flow + localStorage persistence. Standalone draft endpoints (POST /api/sales/draft) not needed — the isHeld Sale IS the server draft.

---

### Session S14 — Customer Master & Sales Attribution
**Goal:** Customer entity feeding sales, receipts, CRM, warranty.

**Scope / Tasks:**
- `customers(name, phone, address, type[RETAIL/INSTALLER], opening_balance)`.
- Salesman attribution on every sale (`salesman_id`).
- Customer ledger preview (sales − receipts + opening).

**API endpoints:** `GET/POST/PATCH/DELETE /api/customers`, `GET /api/customers/:id/ledger`.

**UI screens:** `/(app)/customers` list + detail.

**Acceptance criteria:** a sale attributes to the logged-in salesman and appears on the customer ledger.

---

## 6. Phase P3 — Accounting (Sessions S15–S16)

**Phase goal:** A cash-book-style ledger (single-entry) plus party settlement — the money spine.

### Session S15 — Income/Expense, Account Heads & Cash Book
**Goal:** §4.4 lightweight accounting.

**Scope / Tasks:**
- `transactions(type[IN/EXP/RECV/PAY], party_type, party_id, account_head_id, amount, mode, date, narration, ref_invoice_id, attachment_url)`.
- `account_heads(name, kind[IN/EXP])` tenant-customisable.
- Daily cash summary: opening + receipts (sales cash + income) − payments (expense + supplier).
- Attachment upload (bill photo) via `IStorage`.

**API endpoints:** `GET/POST /api/transactions`, `GET/POST /api/account-heads`, `GET /api/reports/cash-book` (preview).

**UI screens:** `/(app)/accounting/new`, `/(app)/accounting` list, `/(app)/accounting/heads`, cash-book day view.

**Acceptance criteria:** saving an electricity expense reduces daily cash closing correctly.

---

### Session S16 — Customer Receipts & Supplier Payments
**Goal:** §4.5 money-in/out with multi-invoice settle.

**Scope / Tasks:**
- Receipt (customer money-in) + Payment (supplier money-out) as `transactions` rows typed `RECV`/`PAY`.
- Against-invoices multi-select: FIFO auto-allocate or manual.
- Adjustment (discount/round-off), narration (cheque no., ref).
- Modes: Cash/Bank/bKash/Nagad/Cheque.
- On save: updates customer receivable / supplier payable + cash book.

**API endpoints:** `POST /api/receipts`, `POST /api/payments`, `GET /api/invoices/open?type=customer|supplier`.

**UI screens:** `/(app)/receipts/new`, `/(app)/payments/new`, party-wise settlement view.

**Acceptance criteria:** a receipt settles 2 invoices FIFO and leaves the residual as adjustment or open due.

---

## 7. Phase P4 — Employees & Payroll (Session S17)

**Phase goal:** §4.6 employee master + monthly salary that auto-posts as an expense.

### Session S17 — Employee Setup & Salary Sheet
**Goal:** Employee CRUD, monthly salary, advance/deduction, disbursement → expense.

**Scope / Tasks:**
- `employees(name, phone, role, join_date, salary, status)`.
- `salary_records(employee_id, month, basic, allowance, advance_deduction, paid_on)`.
- Disburse salary → creates an `EXP` transaction (account head: Salary) automatically.
- Track advance salary + outstanding per employee.
- Monthly salary sheet report (preview; full in P5).

**API endpoints:** `GET/POST/PATCH/DELETE /api/employees`, `GET/POST /api/salary-records`, `POST /api/salary-records/:id/disburse`.

**UI screens:** `/(app)/employees`, `/(app)/employees/[id]` (advance/outstanding), `/(app)/payroll/new` (monthly sheet), `/(app)/payroll`.

**Acceptance criteria:** disbursing salary creates a linked expense transaction visible in the cash book.

---

## 8. Phase P5 — Reports (Sessions S18–S19)

**Phase goal:** All 10 reports from §5.3, printable (PDF), exportable (Excel/CSV), date-ranged, render under 1s for 10k transactions.

### Session S18 — Core Operational Reports
**Goal:** Stock Summary, Sales, Purchase, Profit/Loss, Customer Ledger, Supplier Ledger, Cash Book, Income/Expense.

**Scope / Tasks:**
- Shared report engine: date range + party + product filters, pagination, totals row.
- Each report: in-app table (TanStack Table) + Recharts summary chart.
- PDF (react-pdf) + CSV/Excel export.
- Performance: indexes (from S02) + query review to hit <1s on 10k rows.

**API endpoints:** `GET /api/reports/{stock|sales|purchase|profit-loss|customer-ledger|supplier-ledger|cash-book|income-expense}?from&to&...&format=pdf|csv`.

**UI screens:** `/(app)/reports` index + one screen per report.

**Acceptance criteria:** each report renders <1s with 10k seeded transactions; PDF + CSV export succeed.

---

### Session S19 — Specialised Reports (Warranty, Payroll, Quotation, RMA)
**Goal:** Warranty Expiry, Employee Salary Sheet, Quotation Register, RMA Status reports.

**Scope / Tasks:**
- Warranty Expiry: upcoming ends by date window.
- Employee Salary Sheet: monthly payroll summary.
- Quotation Register: all quotes by status/customer/date + win/loss + conversion rate.
- RMA Status: open RMAs by stage, vendor turnaround time, overdue list.
- Same PDF/CSV export + filters as S18.

**API endpoints:** `GET /api/reports/{warranty-expiry|salary-sheet|quotation-register|rma-status}`.

**UI screens:** one screen per report under `/(app)/reports`.

**Acceptance criteria:** all 10 reports present, exportable, <1s render target met.

---

## 9. Phase P6 — CRM & Reminders (Sessions S20–S22)

**Phase goal:** Turn one-time buyers into repeat clients (CRM), track faulty units through the vendor repair pipeline (RMA), and a unified reminder engine that never misses a due date (incl. subscription bill).

### Session S20 — Review & Customer Follow-up CRM
**Goal:** §5.4 CRM panel.

**Scope / Tasks:**
- Customer card: name, phone (click-to-call `tel:`), last purchase, total spent, warranty status.
- Purchase history timeline per customer.
- `follow_ups(customer_id, note, rating[HAPPY/NEUTRAL/UNHAPPY], next_due_date, created_by)`.
- Feedback capture tagged to invoice/product.
- Filter: customers not contacted in 30/60/90 days → call list.
- Auto-task: 7-day follow-up call reminder after each sale.

**API endpoints:** `GET /api/crm/customers`, `GET /api/crm/customers/:id/timeline`, `POST /api/follow-ups`, `GET /api/crm/call-list?days=30|60|90`.

**UI screens:** `/(app)/crm` (customer cards + filters), `/(app)/crm/customers/[id]`.

**Acceptance criteria:** after a sale, a 7-day follow-up reminder is auto-scheduled; call-list filter returns the right customers.

---

### Session S21 — Vendor RMA Pipeline (5 Stages)
**Goal:** §5.7 RMA tracking end-to-end.

**Scope / Tasks:**
- `rma_tickets(rma_no, date_opened, customer_id, sale_id, inventory_unit_id, product_id, supplier_id, fault_reason, stage, vendor_rma_ref, vendor_charge, eta)`.
- `rma_history(rma_ticket_id, stage, timestamp, actor_user_id, notes)` — timestamped transitions.
- 5-stage pipeline: Received from Customer → Sent to Vendor → Under Repair/Replacement → Returned from Vendor → Delivered to Customer.
- Auto-warranty check on open (in-warranty free vs out-of-warranty chargeable).
- Overdue alert: ETA passed at "Sent to Vendor" → dashboard flag + owner SMS.
- Replacement flow: new serial linked to original inventory unit + warranty record.
- Customer SMS at each stage transition.
- Skip-stage support with mandatory note.

**API endpoints:** `GET/POST /api/rma`, `GET /api/rma/[id]`, `POST /api/rma/:id/transition` (stage + note), `GET /api/rma/overdue`.

**UI screens:** `/(app)/rma` (pipeline board + filters), `/(app)/rma/new`, `/(app)/rma/[id]` (stage timeline).

**Acceptance criteria:** an RMA tracks all 5 stages with timestamped history; ETA miss raises an owner alert.

---

### Session S22 — Reminder Engine + SMS Gateway
**Goal:** §5.5 unified reminders (incl. subscription bill, warranty expiry, low stock, customer follow-up, service ticket due, tradelicense, rent, electricity, internet/gas, salary).

**Scope / Tasks:**
- `reminders(type, title, amount, frequency, next_due, channel, active)`.
- Worker (behind `IQueue`) checks hourly: `next_due ≤ now` → send SMS/in-app push → advance `next_due` by frequency.
- `INotifier` adapter: email (Resend stub) + SMS (SSL Wireless/Twilio stub).
- Subscription bill reminder (day 25) wired to the lifecycle from S05.
- Dashboard "due today" widget + per-type views.
- All due reminders dispatched within a 60-second window of trigger time.

**API endpoints:** `GET/POST/PATCH /api/reminders`, `GET /api/reminders/due-today`.

**UI screens:** `/(app)/reminders` (list + types), `/(app)/reminders/new`, dashboard due-today widget.

**Acceptance criteria:** a reminder with `next_due = now` is dispatched within 60s and its `next_due` advances correctly.

---

## 10. Phase P7 — Polish & Launch (Sessions S23–S25)

**Phase goal:** A premium, bilingual, installable, fast SaaS ready for beta tenants.

### Session S23 — Bangla i18n + Dark Mode Polish
**Goal:** §6 Bangla/English toggle on 100% of user-facing strings; refined dark mode.

**Scope / Tasks:**
- i18n bundle (en + bn) covering every UI string.
- Language toggle persisted per user.
- Dark-mode audit on every screen (contrast, explicit colours on coloured backgrounds).
- BDT formatting (`৳`, lakh/crore grouping optional) + Bangla numerals option.

**Acceptance criteria:** toggle flips 100% of strings; no untranslated tokens; dark mode passes contrast audit.

---

### Session S24 — PWA, Offline-Tolerance & Performance
**Goal:** §6 PWA install + offline cart/form drafts + Lighthouse ≥ 90 mobile.

**Scope / Tasks:**
- PWA manifest + service worker (installable, standalone).
- localStorage draft persistence for cart + forms; sync on reconnect.
- Performance pass: code-split, image optimisation, query caching (TanStack Query), skeleton loaders.
- Lighthouse audit; fix regressions to ≥ 90 on perf/a11y/best-practice.

**Acceptance criteria:** app installs to home screen; a half-filled cart survives offline reload; Lighthouse ≥ 90.

---

### Session S25 — Subscription Hardening, Onboarding & Beta Launch
**Goal:** Finalise lifecycle edge cases, guided onboarding, and onboard the first beta tenants.

**Scope / Tasks:**
- Subscription edge cases: manual unlock, grace extension, locked-data preservation, email-change cooldown enforcement.
- Guided 4-step onboarding after first verified payment: business profile → products → suppliers → first sale.
- CI: GitHub Actions (lint, type-check, prisma migrate dry-run, build).
- Beta: onboard 2–3 real tenants; monitor Sentry/PostHog; fix top issues.
- Definition-of-Done checklist run (§11) end-to-end on a phone.

**Acceptance criteria:** every Definition-of-Done item passes; a beta tenant completes Purchase→Sale→Receipt→Report on mobile in <3 minutes.

---

## 11. Definition of Done (mapped to sessions)

| DoD item (doc §10) | Verified in |
|---|---|
| Full Purchase→Sale→Receipt→Report cycle on mobile <3 min | S25 |
| Tenant data provably isolated (no cross-tenant reads) | S02 |
| Warranty card PDF + SMS within 5s of sale | S12 |
| All 10 reports render <1s @ 10k transactions | S18–S19 |
| Reminder worker dispatches within 60s of trigger | S22 |
| Lighthouse ≥ 90 mobile | S24 |
| Bangla + English toggle on 100% of strings | S23 |
| Accepted quotation → Sales Invoice in one click | S10 |
| RMA tracks all 5 stages with timestamped history + ETA alerts | S21 |
| Exactly one tenant account per email (DB UNIQUE) | S02, S03 |
| Subscription reminder day 25 · grace day 30 · lock day 40 | S05 |
| Admin verify extends cycle_end +30 days, access restored ≤60s | S05 |

---

## 12. Cross-Cutting Concerns (apply every session)

- **Tenant guard:** every query passes through the `tenant_id` middleware; every create injects `tenant_id`.
- **Role guard:** Owner/Manager/Salesman/Accountant enforced on every API route.
- **Soft delete:** `deleted_at` on all business tables; queries filter `deleted_at IS NULL`.
- **Money:** BDT, 2 decimals, single source of truth in `transactions`.
- **Adapter interfaces:** `IQueue`, `IStorage`, `INotifier`, `ITenantGuard` — never call SDKs directly in business logic.
- **Validation:** Zod on every API input + form.
- **Toasts:** success/error feedback on every mutation.
- **Mobile-first:** every screen designed at 360px before desktop.
- **Sticky footer:** root `min-h-screen flex flex-col` + `mt-auto` footer, every layout.
- **Accessibility:** semantic HTML, ARIA, ≥44px targets, keyboard nav, `sr-only` labels.
- **Commit cadence:** one commit per session (or more), pushed to the repo at phase boundaries.

---

## 13. Repo Upload / Phase Gate Protocol

After each phase is complete:
1. Run that phase's acceptance criteria on the dev server.
2. Commit all work with message `phase(Px): <phase name> complete`.
3. Push to `github.com/sajidchowdhury/cctv` on `main`.
4. Update this file's **Phase status** table below.

### Phase status

| Phase | Status | Sessions done | Pushed (commit) |
|-------|--------|---------------|------------------|
| P0 Foundation | ✅ Done (S01 ✅, S02 ✅, S03 ✅, S04 ✅, S05 ✅) | 5/5 | session(S05) |
| P1 Catalogue & Stock | ✅ Done (S06 ✅, S07 ✅, S08 ✅, S09 ✅) | 4/4 | session(S09) |
| P2 Sales & Invoicing | 🔄 In progress (S10 ✅, S11 ✅, S12 ✅, S13 ✅) | 4/5 | session(S13) |
| P3 Accounting | ☐ Not started | 0/2 | — |
| P4 Employees & Payroll | ☐ Not started | 0/1 | — |
| P5 Reports | ☐ Not started | 0/2 | — |
| P6 CRM & Reminders | ☐ Not started | 0/3 | — |
| P7 Polish & Launch | ☐ Not started | 0/3 | — |

> When all rows read **✅ Done**, the SaaS is workable end-to-end.

---

*End of implementation plan. Phase P0 + P1 complete. Phase P2 in progress (S10–S13 ✅). Next: S14 — Customer Master & Sales Attribution (completes P2).*
