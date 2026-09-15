/**
 * POST /api/account/password — change the current user's password.
 *
 * Requires the current password for verification. Returns 200 on success,
 * 401 if the current password is wrong, 422 if the new password is too short.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const POST = withTenant(async (user, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 422 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch the user with their current password hash.
  const u = await adminDb.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, name: true },
  });

  if (!u || !u.passwordHash) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Verify current password.
  const ok = await bcrypt.compare(currentPassword, u.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  // Hash + update.
  const newHash = await bcrypt.hash(newPassword, 10);
  await adminDb.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true, message: "Password changed successfully." });
});
