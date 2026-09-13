# CCTV Inventory SaaS

Multi-tenant inventory, sales, accounting & reminder platform for CCTV retail
and service businesses in Bangladesh.

Built per `IMPLEMENTATION_PLAN.md` (derived from
`CCTV_Inventory_SaaS_TechnicalDoc_v1.2`).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui (New York) + Radix |
| Forms / Tables | React Hook Form + TanStack Table v8 |
| State / Data | TanStack Query + Zustand |
| Backend | Next.js Route Handlers (REST) |
| ORM | Prisma 6 (SQLite for dev → PostgreSQL for prod) |
| Auth | NextAuth.js v4 (RBAC: Owner / Manager / Salesman / Accountant) |
| PDF | @react-pdf/renderer |
| Charts | Recharts |
| Queue (dev) | In-memory worker → Redis + BullMQ in prod |
| Storage (dev) | Local filesystem → Cloudflare R2 / MinIO in prod |
| Notifier (dev) | Console logger → Resend + SSL Wireless / Twilio in prod |

## Getting Started

```bash
# 1. Install deps
bun install

# 2. Copy env
cp .env.example .env

# 3. Push DB schema
bun run db:push

# 4. Start dev server (port 3000)
bun run dev
```

Open the Preview Panel to view the app at `/`.

## Folder Contract

```
src/
├── app/
│   ├── page.tsx              # / route (dashboard placeholder until S04)
│   ├── layout.tsx            # root layout (fonts, Toaster)
│   ├── globals.css           # Tailwind + theme tokens (light/dark)
│   ├── api/                  # REST route handlers (tenant-scoped)
│   │   └── route.ts          #   GET /api  → health check
│   ├── (app)/                # authenticated tenant app (S04 shell)
│   │   └── layout.tsx        #   → mobile-first nav + sticky footer
│   ├── (auth)/               # login / signup / payment / locked (S03, S05)
│   │   └── layout.tsx
│   └── admin/                # super-admin control plane (S05)
│       └── layout.tsx
├── components/
│   ├── ui/                   # shadcn/ui primitives (pre-installed)
│   └── (domain components added per session)
├── hooks/
│   ├── use-toast.ts
│   └── use-mobile.ts
└── lib/
    ├── db.ts                 # Prisma client singleton
    ├── utils.ts              # cn() class merger
    ├── auth.ts               # NextAuth config (stub → S03)
    ├── tenant-context.ts     # tenant_id resolver (stub → S02/S03)
    ├── format.ts             # BDT currency + Asia/Dhaka date utils
    └── adapters/             # swappable infrastructure (prod-ready)
        ├── queue.ts          #   IQueue + InMemoryQueue → Redis/BullMQ
        ├── storage.ts        #   IStorage + LocalStorageDriver → R2/MinIO
        ├── notifier.ts       #   INotifier + ConsoleNotifier → Resend/Twilio
        └── index.ts         #   barrel
prisma/
└── schema.prisma             # full model in S02
```

### Route Groups
- `(app)` — authenticated tenant screens; tenant-scoped + role-guarded.
- `(auth)` — unauthenticated auth + billing screens; no tenant context.
- `admin` — super-admin control plane; separate auth.

### Adapter Pattern
Every external dependency (DB, queue, storage, notifier) sits behind an
interface in `src/lib/adapters/`. Dev uses in-memory/local/console stubs;
production swaps to Redis/R2/Resend by changing one env var — **zero
business-logic changes**.

## Architecture Rules (doc §3, §6)
- `tenant_id` is mandatory on every business table; enforced in app layer +
  DB unique constraints (SQLite has no RLS → replicated via Prisma middleware).
- Soft delete (`deleted_at`) on all business tables.
- Money is BDT, 2 decimals.
- Dates stored UTC, displayed in `Asia/Dhaka`.
- Mobile-first: 360px → 768px → 1280px+.
- One primary action per screen; sticky footer; ≥44px tap targets.

## Scripts
| Script | Purpose |
|--------|---------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push Prisma schema to DB |
| `bun run db:generate` | Regenerate Prisma client |

## Status
Phase P0 — Foundation. See `IMPLEMENTATION_PLAN.md` §13 for the phase tracker.
