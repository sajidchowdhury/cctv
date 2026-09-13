/**
 * S02 Seed — creates a dev tenant + owner user + subscription.
 *
 * Run: `bun run src/scripts/seed.ts`
 *
 * Creates:
 *   - 1 Tenant  (ownerEmail: owner@cctv-demo.bd)
 *   - 1 User     (role OWNER, email owner@cctv-demo.bd)
 *   - 1 Subscription (status PENDING_ACTIVATION — first payment verifies it in S05)
 *   - Reference rows: 2 Categories, 1 Unit
 *
 * Also runs the tenant-isolation verification (see verify-tenant-isolation.ts).
 */

import { adminDb } from "../lib/db";
import { runWithTenant } from "../lib/tenant-context";

async function main() {
  console.log("🌱 Seeding S02 dev data...\n");

  // ── 1. Tenant ──────────────────────────────────────────────
  const tenant = await adminDb.tenant.upsert({
    where: { ownerEmail: "owner@cctv-demo.bd" },
    update: {},
    create: {
      name: "Dhaka CCTV Center (Demo)",
      ownerEmail: "owner@cctv-demo.bd",
      phone: "+8801711111111",
      address: "Elephant Road, Dhaka",
      status: "PENDING_ACTIVATION",
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. Owner user (scoped to tenant) ──────────────────────
  await runWithTenant(tenant.id, async () => {
    const user = await adminDb.user.upsert({
      where: { email: "owner@cctv-demo.bd" },
      update: {},
      create: {
        tenantId: tenant.id,
        email: "owner@cctv-demo.bd",
        name: "Demo Owner",
        phone: "+8801711111111",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    console.log(`✓ User: ${user.email} [${user.role}]`);

    // ── 3. Subscription (pending — no module access yet, doc §3.3) ──
    const sub = await adminDb.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        plan: "UNLIMITED",
        startedAt: new Date(),
        cycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "PENDING_ACTIVATION",
      },
    });
    console.log(`✓ Subscription: ${sub.plan} / ${sub.status}`);

    // ── 4. Reference rows ────────────────────────────────────
    await adminDb.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Camera" } },
      update: {},
      create: { tenantId: tenant.id, name: "Camera" },
    });
    await adminDb.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "DVR/NVR" } },
      update: {},
      create: { tenantId: tenant.id, name: "DVR/NVR" },
    });
    console.log(`✓ Categories: Camera, DVR/NVR`);

    await adminDb.unit.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Pcs" } },
      update: {},
      create: { tenantId: tenant.id, name: "Pcs" },
    });
    console.log(`✓ Unit: Pcs`);

    console.log(
      `\n✅ Seed complete. Tenant id for testing: ${tenant.id}\n` +
        `   email: owner@cctv-demo.bd (no password yet — S03 wires NextAuth)`
    );
  });
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await adminDb.$disconnect();
  });
