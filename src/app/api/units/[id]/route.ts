/**
 * DELETE /api/units/[id] — soft-delete a unit.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const DELETE = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await db.unit.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
