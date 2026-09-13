---
Task ID: S02
Agent: Z.ai Code (main)
Task: Session S02 — Database Schema, Prisma & Tenant Isolation. Land the full data model from doc §7 with tenant_id everywhere, soft deletes, UNIQUE(email) constraints, and a Prisma client extension that replicates PostgreSQL RLS on SQLite. Seed a dev tenant + owner. Verify cross-tenant isolation + 1-email-per-account at DB level.

Work Log:
- Read prior context: worklog.md (none — S01 didn't create one), dev.log (clean), git at commit 1609491 (S01).
- Read existing prisma/schema.prisma (only User + Post stubs), src/lib/db.ts, src/lib/tenant-context.ts (S01 stubs).
- Authored full prisma/schema.prisma: 24 business models + Tenant + reference tables (Category, Unit). Every business model carries tenant_id + created_at/updated_at/deleted_at. SQLite workarounds documented (no native enums → string+validation; no array column → serials as JSON string; money as Float).
- UNIQUE constraints: users.email (global), tenants.owner_email, plus tenant-scoped uniques (category names, unit names, invoice numbers, SKUs, RMAs, quotes, salary month).
- Indexes added on all hot query paths (tenant_id + date / status / party / product).
- Rewrote src/lib/tenant-context.ts with AsyncLocalStorage-based runWithTenant()/getTenantId()/requireTenantId() — per-request tenant scoping without global pollution.
- Rewrote src/lib/db.ts with a Prisma client extension ($extends) that auto-injects tenant_id on create/createMany and auto-filters findUnique/findFirst/findMany/count/aggregate/update/updateMany/delete/deleteMany. Added adminDb (raw client, no extension) for super-admin cross-tenant paths.
- Fixed 5 schema validation errors during db:push: (1) Quotation↔Sale 1:1 relation fields on both sides, (2) convertedSaleId needed @unique, (3) Product needed back-relation for QuotationItem, (4) SaleItem↔InventoryUnit 1:1 needed @unique + single owning side, (5) Unit.products back-relation + Product.unit relation naming conflict (dropped redundant denormalised String, kept relation).
- Removed deprecated previewFeatures=["clientExtensions"] flag (functionality is stable in Prisma 6).
- Wrote src/scripts/seed.ts: creates demo tenant (Dhaka CCTV Center), owner@cctv-demo.bd (OWNER role), UNLIMITED subscription (PENDING_ACTIVATION), 2 categories, 1 unit. Idempotent via upsert.
- Wrote src/scripts/verify-tenant-isolation.ts: 4 automated tests — (T1) tenant A findMany sees only A's products, (T2) tenant B can't fetch A's product, (T3) duplicate email rejected (P2002), (T4) create auto-injects tenantId from context.
- DEBUG: first verification run failed — extension hook wasn't filtering. Root cause: TENANT_SCOPED_MODELS set contained lowercase names ("product") but Prisma passes PascalCase model names ("Product"). Fixed casing in both TENANT_SCOPED_MODELS and SOFT_DELETE_MODELS sets.
- Cleaned orphan test data (reset DB), re-seeded, re-ran verification → ALL 4 TESTS PASS.
- Added db:seed and db:verify scripts to package.json.
- Lint: bun run lint clean (zero errors). Dev server: /api health check returns {db:"ok"}.

Stage Summary:
- Deliverables: prisma/schema.prisma (24 models, full doc §7 coverage), src/lib/db.ts (tenant-isolation Prisma extension + adminDb), src/lib/tenant-context.ts (AsyncLocalStorage tenant scoping), src/scripts/seed.ts, src/scripts/verify-tenant-isolation.ts, package.json scripts.
- Key decision: tenant isolation via Prisma client extension (auto-filter reads + auto-inject creates) replicates PostgreSQL RLS on SQLite. Production swap to Postgres = flip datasource provider + add RLS policies as defence-in-depth; the extension stays as a second guard.
- Acceptance: 3/3 criteria pass. Cross-tenant reads return empty. Duplicate email rejected at DB level (P2002). Schema matches every table in doc §7.
- Phase status: P0 Foundation now 2/5 sessions (S01 ✅, S02 ✅). Next: S03 — Auth, RBAC & 1-Email-Per-Account.
- Artifacts committed: schema.prisma, db.ts, tenant-context.ts, seed.ts, verify-tenant-isolation.ts, package.json scripts, updated IMPLEMENTATION_PLAN.md.

---
Task ID: S03
Agent: Z.ai Code (main)
Task: Session S03 — Auth, RBAC & 1-Email-Per-Account. NextAuth credentials provider, Owner/Manager/Salesman/Accountant role guards, email verification (OTP), locked-tenant gate redirecting to /payment, session carrying tenantId/role/subscriptionStatus.

Work Log:
- Read S02 worklog + current auth.ts (stub), tenant-context.ts (AsyncLocalStorage), .env (only DATABASE_URL).
- Installed bcryptjs + @types/bcryptjs for password hashing. Added NEXTAUTH_SECRET + NEXTAUTH_URL to .env.
- Wrote src/lib/auth.ts: full NextAuth config with CredentialsProvider. JWT callback stashes userId/tenantId/role/subscriptionStatus + refreshes subscription status from DB every 60s (so admin verify/lock takes effect within ~1 min without re-login). Session callback exposes them on session.user. Type augmentation for Session + JWT.
- Wrote src/app/api/auth/[...nextauth]/route.ts (NextAuth handler).
- Wrote src/app/api/auth/signup/route.ts: Zod validation, 1-email-per-account check (friendly 409 EMAIL_TAKEN + hard DB UNIQUE backstop), bcrypt hash, transactional tenant+user+subscription+emailVerification create, OTP "sent" via INotifier (console in dev). Tenant starts PENDING_ACTIVATION (no free trial).
- Wrote src/app/api/auth/verify-email/route.ts: OTP verification (6-digit, 10-min expiry), marks EmailVerification consumed.
- Wrote src/app/api/auth/change-email/route.ts: authenticated, checks new email free, sends OTP to new address, 7-day cooldown noted.
- Wrote src/lib/session.ts: withTenant() wrapper (auth check → locked gate → runWithTenant scope) + withRole() wrapper (role check → 403). getSessionUser() helper.
- Wrote src/app/api/test/accounting/route.ts: role-guard demo endpoint (ACCOUNTANT/OWNER only).
- Wrote src/proxy.ts (Next.js 16 "proxy" convention, formerly middleware): withAuth + locked-tenant gate. LOCKED/PENDING_ACTIVATION → redirect to /payment. Matcher excludes api + auth pages + static.
- Wrote src/app/providers.tsx (SessionProvider + ThemeProvider) + updated root layout to wrap providers.
- Wrote (auth) UI: /login (credentials form), /signup (5-field form with EMAIL_TAKEN → "login instead" link), /verify-email (OTP entry, prefilled email), /change-email, /payment (lockout screen placeholder for S05).
- Wrote (app)/page.tsx: dashboard showing user name/role/subscription badge + billing card + logout. Removed old S01 root placeholder.
- Updated seed.ts: demo tenant ACTIVE + password "password123" for owner + salesman@cctv-demo.bd (SALESMAN) for role-guard test.
- Renamed middleware.ts → proxy.ts (Next.js 16 deprecation: "middleware" → "proxy").

Bugs found + fixed:
- authorize() failed with "Unknown field tenant for include on User" — stale Prisma client in turbopack cache. Fixed by restarting the dev server (regenerated client loaded).
- Dev server kept dying between Bash tool invocations (background process limitation). Worked around by running server + tests in a single Bash command.
- zod validation ran before the duplicate-email check on signup — first test got 422 (phone too short) instead of 409. Fixed test to use valid data; validation order is correct (validate → business check).

Acceptance criteria (all pass — verified via curl + Agent Browser):
- [x] Duplicate email signup → 409 EMAIL_TAKEN with "login instead" message (curl)
- [x] Locked tenant → GET / returns 307 redirect to /payment (curl + browser)
- [x] /payment accessible (200) for locked user (browser)
- [x] Role guard: salesman → /api/test/accounting → 403 Forbidden (curl)
- [x] Browser e2e: login as owner → / dashboard renders (name, role, subscription badge) (Agent Browser)
- [x] Browser e2e: login as locked owner → redirected to /payment (Agent Browser)
- [x] bun run lint clean

Stage Summary:
- Deliverables: auth.ts (NextAuth config), 4 API routes (signup, verify-email, change-email, [...nextauth]), session.ts (withTenant/withRole guards), proxy.ts (locked-tenant gate), providers.tsx, 5 (auth) UI pages, (app)/page.tsx dashboard, test/accounting endpoint, updated seed.ts.
- Key decision: JWT refreshes subscriptionStatus from DB every 60s so the locked-tenant gate takes effect without re-login (doc §3.3 "access restored within 60 seconds"). withTenant wraps every API route in runWithTenant so the S02 Prisma extension auto-scopes queries.
- Acceptance: 3/3 criteria pass + browser e2e verified. Login → dashboard; locked → /payment; duplicate email → 409; salesman → 403.
- Phase status: P0 Foundation now 3/5 sessions (S01 ✅, S02 ✅, S03 ✅). Next: S04 — Base UI Shell, Navigation & Theme.
- Artifacts committed: auth.ts, 4 API routes, session.ts, proxy.ts, providers.tsx, 5 auth UI pages, dashboard, test endpoint, seed.ts, worklog.md.
