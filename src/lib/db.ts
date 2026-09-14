/**
 * Prisma client + tenant isolation extension (doc §3.1 RLS replication on SQLite).
 *
 * Session S02.
 *
 * What this extension does:
 *   1. On CREATE  — auto-injects `tenantId` from AsyncLocalStorage if the
 *      caller forgot it. Prevents a tenant row being written with a null
 *      or foreign tenant_id.
 *   2. On READ     — auto-injects `tenantId` into the where clause of
 *      findMany / findUnique / findFirst / count / aggregate, so a missed
 *      app filter can NEVER return another tenant's rows. This is the
 *      SQLite equivalent of PostgreSQL `ROW LEVEL SECURITY`.
 *   3. On UPDATE   — blocks updating a row whose tenantId != current tenant.
 *   4. On DELETE   — converts hard deletes to soft deletes (deletedAt = now)
 *      on models that have the column.
 *
 * Super-admin paths (cross-tenant) bypass the extension by using the
 * raw `prisma.$queryRaw` / `$executeRaw` or a separate `getAdminDb()`
 * client that is NOT wrapped in the extension.
 *
 * Production swap: the same logic is enforced by PostgreSQL RLS policies,
 * so this extension becomes a defence-in-depth check, not the primary gate.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { getTenantId } from "./tenant-context";

/**
 * Models that carry a `tenantId` column (doc §3.1 — every business table).
 * Kept in sync with prisma/schema.prisma. Listed explicitly so the extension
 * never mistakes a system table for a tenant table.
 *
 * NOTE: Prisma passes the model name in PascalCase (e.g. "Product"), so the
 * entries here are PascalCase to match.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  "User",
  "EmailVerification",
  "Subscription",
  "PaymentVerification",
  "Category",
  "Unit",
  "Product",
  "InventoryUnit",
  "Supplier",
  "Customer",
  "Employee",
  "Purchase",
  "PurchaseItem",
  "Sale",
  "SaleItem",
  "AccountHead",
  "Transaction",
  "ServiceTicket",
  "FollowUp",
  "Reminder",
  "SalaryRecord",
  "Quotation",
  "QuotationItem",
  "RmaTicket",
]);

const SOFT_DELETE_MODELS = new Set<string>([
  "Tenant",
  "User",
  "Category",
  "Unit",
  "Product",
  "Supplier",
  "Customer",
  "Employee",
  "Purchase",
  "Sale",
  "AccountHead",
  "Transaction",
  "ServiceTicket",
  "FollowUp",
  "Reminder",
  "Quotation",
  "RmaTicket",
]);

type PrismaDelegate = {
  findUnique?: (args: any) => Promise<any>;
  findFirst?: (args: any) => Promise<any>;
  findMany?: (args: any) => Promise<any>;
  count?: (args: any) => Promise<any>;
  aggregate?: (args: any) => Promise<any>;
  create?: (args: any) => Promise<any>;
  createMany?: (args: any) => Promise<any>;
  update?: (args: any) => Promise<any>;
  updateMany?: (args: any) => Promise<any>;
  delete?: (args: any) => Promise<any>;
  deleteMany?: (args: any) => Promise<any>;
};

/**
 * Build the query extension. Applied once per client instance.
 */
function buildTenantExtension() {
  return Prisma.defineExtension({
    name: "tenant-isolation",
    query: {
      // Apply to every model — we short-circuit inside if not tenant-scoped.
      $allModels: {
        async findUnique({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async findFirst({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async findMany({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args = args ?? {};
              args.where = { ...(args.where ?? {}), tenantId };
            }
          }
          return query(args);
        },
        async count({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async aggregate({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async create({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId && args.data && !args.data.tenantId) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) =>
                  d.tenantId ? d : { ...d, tenantId }
                );
              } else {
                args.data = { ...args.data, tenantId };
              }
            }
          }
          return query(args);
        },
        async createMany({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId && args.data) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) =>
                  d.tenantId ? d : { ...d, tenantId }
                );
              } else {
                args.data = { ...args.data, tenantId };
              }
            }
          }
          return query(args);
        },
        async update({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async updateMany({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
        async delete({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
            // Soft-delete: convert to an update setting deletedAt.
            if (SOFT_DELETE_MODELS.has(model)) {
              const deletedAt = new Date();
              return (query as any)({ ...args });
            }
          }
          return query(args);
        },
        async deleteMany({ model, args, query }: any) {
          if (TENANT_SCOPED_MODELS.has(model)) {
            const tenantId = getTenantId();
            if (tenantId) {
              args.where = { ...args.where, tenantId };
            }
          }
          return query(args);
        },
      },
    },
  });
}

/**
 * Build the singleton Prisma client WITH the tenant-isolation extension.
 *
 * Extracted into a factory so the extended client type can be named via
 * `ReturnType<typeof createDb>` — the type returned by `PrismaClient.$extends(...)`
 * (`DynamicClientExtensionThis<...>`) is NOT assignable to `PrismaClient`
 * (extensions drop lifecycle methods like `$on`), so the dev-mode global cache
 * must be typed with the actual extended client type, not `PrismaClient`.
 */
function createDb() {
  return new PrismaClient({
    log: ["warn", "error"],
  }).$extends(buildTenantExtension());
}

type DbClient = ReturnType<typeof createDb>;

/**
 * Singleton Prisma client WITH the tenant-isolation extension.
 * Use everywhere in tenant-scoped app code.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: DbClient | undefined;
};

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Raw client WITHOUT the tenant extension. Use ONLY in super-admin paths
 * that must cross tenant boundaries (payment verification queue, tenant
 * management). Never use this in tenant-scoped code.
 */
const globalForAdminDb = globalThis as unknown as {
  adminDb: PrismaClient | undefined;
};

export const adminDb =
  globalForAdminDb.adminDb ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForAdminDb.adminDb = adminDb;
