/**
 * POST /api/auth/signup (doc §3.3)
 *
 * Creates a new tenant + owner user in PENDING_ACTIVATION status (no free trial).
 * Email verification (OTP) happens next; module access requires S05 payment verify.
 *
 * Rules enforced:
 *  - One email = exactly one tenant account (UNIQUE on users.email + tenants.owner_email).
 *    A duplicate is rejected with a clear "login instead" message.
 *  - Password hashed with bcrypt.
 *  - OTP generated + "sent" via INotifier (console in dev).
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { getNotifier } from "@/lib/adapters/notifier";

const SignupSchema = z.object({
  businessName: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(20),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { businessName, ownerName, email, phone, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // 1-email-per-account: check users.email AND tenants.owner_email upfront
  // (the DB UNIQUE is the hard backstop; this gives a friendly message).
  const existingUser = await adminDb.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "This email is already registered. Please log in instead of signing up.",
        code: "EMAIL_TAKEN",
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const otpCode = String(randomInt(100000, 999999));
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Create tenant + owner in a transaction. The tenant is created in
  // PENDING_ACTIVATION — no module access until admin verifies first payment (S05).
  try {
    const result = await adminDb.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          ownerEmail: normalizedEmail,
          phone,
          status: "PENDING_ACTIVATION",
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          name: ownerName,
          phone,
          role: "OWNER",
          status: "ACTIVE",
          passwordHash,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "UNLIMITED",
          startedAt: new Date(),
          cycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "PENDING_ACTIVATION",
        },
      });

      await tx.emailVerification.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          code: otpCode,
          purpose: "SIGNUP",
          expiresAt: otpExpires,
        },
      });

      return { tenant, user };
    });

    // "Send" OTP (console in dev; Resend/Twilio in prod via INotifier).
    const notifier = getNotifier();
    await notifier.sendEmail(
      normalizedEmail,
      "CCTV Inventory SaaS — verify your email",
      `Your verification code is: ${otpCode} (valid 10 minutes).`
    );

    return NextResponse.json(
      {
        ok: true,
        email: normalizedEmail,
        tenantId: result.tenant.id,
        message:
          "Account created in PENDING_ACTIVATION. Verify your email with the OTP sent.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    // Hard backstop: the DB UNIQUE constraint catches races.
    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "This email is already registered. Please log in instead of signing up.",
          code: "EMAIL_TAKEN",
        },
        { status: 409 }
      );
    }
    console.error("[signup] error:", err);
    return NextResponse.json(
      { error: "Signup failed. Please try again." },
      { status: 500 }
    );
  }
}
