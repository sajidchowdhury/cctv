/**
 * POST /api/admin/tenants/[id]/unlock (doc §3.3.1)
 *
 * Manual grace extension — admin can unlock a locked tenant for a grace
 * period (e.g. bank delay). Sets subscription → ACTIVE, clears lockedAt,
 * extends cycleEnd by 7 days.
 */
import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin-session";
import { adminDb } from "@/lib/db";

const GRACE_EXTENSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const POST = withAdmin(async (admin, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "Missing tenant id." }, { status: 400 });
  }

  const now = new Date();
  const newCycleEnd = new Date(now.getTime() + GRACE_EXTENSION_DAYS * DAY_MS);

  try {
    await adminDb.$transaction([
      adminDb.subscription.update({
        where: { tenantId: id },
        data: { status: "ACTIVE", lockedAt: null, cycleEnd: newCycleEnd },
      }),
      adminDb.tenant.update({
        where: { id },
        data: { status: "ACTIVE" },
      }),
    ]);
    return NextResponse.json({
      ok: true,
      message: `Tenant unlocked with ${GRACE_EXTENSION_DAYS}-day grace extension.`,
      cycleEnd: newCycleEnd,
      extendedBy: admin.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unlock failed." },
      { status: 400 }
    );
  }
});
