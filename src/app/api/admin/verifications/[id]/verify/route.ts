/**
 * POST /api/admin/verifications/[id]/verify (doc §3.3.1 + §3.3)
 *
 * Admin marks a payment VERIFIED → subscription.cycleEnd += 30 days,
 * status ACTIVE, lock lifted. Restores access within 60s (JWT refresh).
 */
import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin-session";
import { verifyPayment } from "@/lib/subscription";

export const POST = withAdmin(async (admin, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  try {
    const result = await verifyPayment(id, admin.id);
    return NextResponse.json({
      ok: true,
      cycleEnd: result.cycleEnd,
      status: result.status,
      message: "Payment verified. Subscription extended by 30 days.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Verify failed." },
      { status: 400 }
    );
  }
});
