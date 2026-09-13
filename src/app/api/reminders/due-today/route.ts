/**
 * GET /api/reminders/due-today — reminders due now or today (doc §5.5).
 * Used by the dashboard "due today" widget.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const GET = withTenant(async (user) => {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const due = await db.reminder.findMany({
    where: {
      deletedAt: null,
      active: true,
      nextDue: { lte: endOfDay },
    },
    orderBy: { nextDue: "asc" },
    take: 20,
  });

  return NextResponse.json({
    reminders: due.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      amount: r.amount,
      nextDue: r.nextDue.toISOString(),
      overdue: r.nextDue <= now,
      hoursLate: r.nextDue <= now
        ? Math.floor((now.getTime() - r.nextDue.getTime()) / (60 * 60 * 1000))
        : 0,
    })),
    count: due.length,
  });
});
