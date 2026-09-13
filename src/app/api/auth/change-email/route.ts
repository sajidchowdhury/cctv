/**
 * POST /api/auth/change-email (doc §3.3)
 *
 * Email change requires OTP verification to the new address + a 7-day cooldown
 * before the old email can be reused. Authenticated route.
 *
 * Flow:
 *   1. User (authenticated) requests change to newEmail.
 *   2. System checks newEmail not already taken.
 *   3. OTP sent to newEmail.
 *   4. (Verify step would confirm — here we create the verification row; a
 *      separate verify-email call with purpose CHANGE_EMAIL confirms it.)
 *   5. On confirm, old email is held for 7 days (cooldown) before reuse.
 */
import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { adminDb } from "@/lib/db";
import { getNotifier } from "@/lib/adapters/notifier";
import { authOptions } from "@/lib/auth";

const ChangeSchema = z.object({
  newEmail: z.string().email(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid new email is required." },
      { status: 422 }
    );
  }
  const newEmail = parsed.data.newEmail.trim().toLowerCase();
  const oldEmail = session.user.email;

  if (newEmail === oldEmail) {
    return NextResponse.json(
      { error: "New email must differ from your current email." },
      { status: 400 }
    );
  }

  // 1-email-per-account: the new email must be free.
  const taken = await adminDb.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "That email is already registered to another account." },
      { status: 409 }
    );
  }

  // Create OTP for the new email (purpose CHANGE_EMAIL).
  const otpCode = String(randomInt(100000, 999999));
  await adminDb.emailVerification.create({
    data: {
      tenantId: session.user.tenantId,
      email: newEmail,
      code: otpCode,
      purpose: "CHANGE_EMAIL",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const notifier = getNotifier();
  await notifier.sendEmail(
    newEmail,
    "Confirm your new email — CCTV Inventory SaaS",
    `Your confirmation code is: ${otpCode} (valid 10 minutes).`
  );

  return NextResponse.json({
    ok: true,
    message: `OTP sent to ${newEmail}. Confirm to complete the change. Old email (${oldEmail}) enters a 7-day cooldown.`,
  });
}
