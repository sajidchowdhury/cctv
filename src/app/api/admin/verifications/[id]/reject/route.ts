/**
 * POST /api/admin/verifications/[id]/reject (doc §3.3.1)
 *
 * Admin rejects a payment — requires a reason. SMS the user to retry.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/admin-session";
import { rejectPayment } from "@/lib/subscription";

const RejectSchema = z.object({
  reason: z.string().min(3).max(300),
});

export const POST = withAdmin(async (admin, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A reason (3–300 chars) is required.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  try {
    await rejectPayment(id, admin.id, parsed.data.reason);
    return NextResponse.json({ ok: true, message: "Payment rejected. User notified to retry." });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Reject failed." },
      { status: 400 }
    );
  }
});
