/**
 * S05 Seed — creates a dev tenant + owner user + subscription (ACTIVE for dev)
 * + a super-admin for the admin control plane (S05).
 *
 * Run: `bun run db:seed`
 *
 * Creates:
 *   - 1 Tenant  (ownerEmail: owner@cctv-demo.bd, status ACTIVE for dev testing)
 *   - 1 User     (role OWNER, email owner@cctv-demo.bd, password "password123")
 *   - 1 Subscription (status ACTIVE — S05 wires the real PENDING_ACTIVATION → verify flow)
 *   - Reference rows: 2 Categories, 1 Unit
 *   - A 2nd user (salesman@cctv-demo.bd, role SALESMAN) for role-guard tests
 *   - 1 SuperAdmin (admin@cctv-saas.bd, password "admin123") for the admin queue
 *
 * NOTE: real signups via /api/auth/signup start PENDING_ACTIVATION. The demo
 * tenant is set ACTIVE here purely so S03/S04 auth flows are testable.
 */

import bcrypt from "bcryptjs";
import { adminDb } from "../lib/db";
import { runWithTenant } from "../lib/tenant-context";

const DEMO_PASSWORD = "password123";

async function main() {
  console.log("🌱 Seeding S03 dev data...\n");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── 1. Tenant (ACTIVE for dev; real signups start PENDING_ACTIVATION) ──
  const tenant = await adminDb.tenant.upsert({
    where: { ownerEmail: "owner@cctv-demo.bd" },
    update: { status: "ACTIVE" },
    create: {
      name: "Dhaka CCTV Center (Demo)",
      ownerEmail: "owner@cctv-demo.bd",
      phone: "+8801711111111",
      address: "Elephant Road, Dhaka",
      status: "ACTIVE",
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id}) — ACTIVE for dev`);

  // ── 2. Owner user (scoped to tenant) ──────────────────────
  await runWithTenant(tenant.id, async () => {
    const user = await adminDb.user.upsert({
      where: { email: "owner@cctv-demo.bd" },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        email: "owner@cctv-demo.bd",
        name: "Demo Owner",
        phone: "+8801711111111",
        role: "OWNER",
        status: "ACTIVE",
        passwordHash,
      },
    });
    console.log(`✓ User: ${user.email} [${user.role}]`);

    // 2nd user: salesman for role-guard test (S03 acceptance)
    const salesman = await adminDb.user.upsert({
      where: { email: "salesman@cctv-demo.bd" },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        email: "salesman@cctv-demo.bd",
        name: "Demo Salesman",
        phone: "+8801722222222",
        role: "SALESMAN",
        status: "ACTIVE",
        passwordHash,
      },
    });
    console.log(`✓ User: ${salesman.email} [${salesman.role}]`);

    // ── 3. Subscription (ACTIVE for dev; S05 wires PENDING_ACTIVATION → verify) ──
    const sub = await adminDb.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { status: "ACTIVE" },
      create: {
        tenantId: tenant.id,
        plan: "UNLIMITED",
        startedAt: new Date(),
        cycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
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
      `\n✅ Tenant + users seeded.\n` +
        `   Tenant: ${tenant.id}\n` +
        `   Login: owner@cctv-demo.bd / ${DEMO_PASSWORD} (OWNER)\n` +
        `   Login: salesman@cctv-demo.bd / ${DEMO_PASSWORD} (SALESMAN)`
    );
  });

  // ── 5. Super-admin (for the S05 admin control plane) ─────────────
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const superAdmin = await adminDb.superAdmin.upsert({
    where: { email: "admin@cctv-saas.bd" },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: "admin@cctv-saas.bd",
      name: "Platform Admin",
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
    },
  });
  console.log(`✓ SuperAdmin: ${superAdmin.email} (password: admin123)`);
  console.log(`\n✅ Seed complete.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await adminDb.$disconnect();
  });
