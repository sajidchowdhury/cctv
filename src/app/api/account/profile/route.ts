/**
 * PATCH /api/account/profile — update the current user's name (display name).
 * Email changes are NOT allowed here (they require email verification flow).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

const Schema = z.object({
  name: z.string().min(2).max(100),
});

export const PATCH = withTenant(async (user, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name must be 2–100 characters." },
      { status: 422 }
    );
  }

  const updated = await adminDb.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user: updated });
});
