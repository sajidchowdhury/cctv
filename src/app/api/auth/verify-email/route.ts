/**
 * POST /api/auth/verify-email (doc §3.3)
 *
 * Verifies the OTP sent at signup. Marks the EmailVerification row consumed.
 * Note: email verification alone does NOT grant module access — the tenant
 * remains PENDING_ACTIVATION until admin verifies the first payment (S05).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db";

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the 6-digit code sent to your email." },
      { status: 422 }
    );
  }
  const { email, code } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const record = await adminDb.emailVerification.findFirst({
    where: {
      email: normalizedEmail,
      purpose: "SIGNUP",
      consumed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json(
      { error: "No valid code found. Please request a new one." },
      { status: 404 }
    );
  }

  if (record.code !== code) {
    return NextResponse.json(
      { error: "Incorrect code. Please try again." },
      { status: 400 }
    );
  }

  await adminDb.emailVerification.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  return NextResponse.json({
    ok: true,
    message:
      "Email verified. Your account is awaiting first payment verification by admin.",
  });
}
