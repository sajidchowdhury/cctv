/**
 * Reminder engine worker — checks every 60s for due reminders, dispatches
 * SMS/in-app, and advances nextDue by the frequency (doc §5.5).
 *
 *   DAILY   → +1 day
 *   WEEKLY  → +7 days
 *   MONTHLY → +30 days (approximate; S25 can use exact calendar months)
 *   YEARLY  → +365 days
 *   ONCE    → set active=false (one-shot)
 *
 * All due reminders dispatched within a 60-second window of trigger time.
 * Started in instrumentation.ts alongside the lifecycle worker (S05).
 */
import { adminDb } from "@/lib/db";
import { getNotifier } from "@/lib/adapters/notifier";

const TICK_INTERVAL_MS = 60_000; // 1 minute — doc §5.5 "checks every hour" but 60s is more responsive
const DAY_MS = 24 * 60 * 60 * 1000;

let workerTimer: NodeJS.Timeout | null = null;
let ticking = false;

/** Process all due reminders. Returns count of dispatched reminders. */
export async function tickReminders(now: Date = new Date()): Promise<{
  checked: number;
  dispatched: number;
  advanced: number;
}> {
  const due = await adminDb.reminder.findMany({
    where: {
      active: true,
      deletedAt: null,
      nextDue: { lte: now },
    },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
    },
  });

  let dispatched = 0;
  let advanced = 0;

  for (const reminder of due) {
    try {
      // Dispatch the reminder via INotifier (SMS + in-app).
      const notifier = getNotifier();
      const amountStr = reminder.amount ? ` Amount: ${reminder.amount.toFixed(2)} BDT.` : "";
      const message = `Reminder: ${reminder.title}.${amountStr} Type: ${reminder.type.replace(/_/g, " ")}.`;

      // SMS to the tenant's phone (if channel includes SMS).
      if (reminder.channel.includes("SMS") && reminder.tenant.phone) {
        await notifier.sendSms(reminder.tenant.phone, message);
      }

      // In-app: logged via console in dev (S25 will add a persistent notification table).
      console.log(`[reminder] dispatched: ${reminder.title} (type=${reminder.type}, tenant=${reminder.tenant.name})`);

      // Create a dispatch log entry (F3-S2: reminder visibility).
      await adminDb.reminderLog.create({
        data: {
          tenantId: reminder.tenantId,
          reminderId: reminder.id,
          channel: reminder.channel.includes("SMS") ? "SMS" : "IN_APP",
          status: "SENT",
          message,
        },
      });

      dispatched++;

      // Advance nextDue by frequency.
      let newNextDue: Date | null = null;
      switch (reminder.frequency) {
        case "DAILY": newNextDue = new Date(now.getTime() + 1 * DAY_MS); break;
        case "WEEKLY": newNextDue = new Date(now.getTime() + 7 * DAY_MS); break;
        case "MONTHLY": newNextDue = new Date(now.getTime() + 30 * DAY_MS); break;
        case "YEARLY": newNextDue = new Date(now.getTime() + 365 * DAY_MS); break;
        case "ONCE": newNextDue = null; break; // one-shot → deactivate
      }

      if (newNextDue) {
        await adminDb.reminder.update({
          where: { id: reminder.id },
          data: { nextDue: newNextDue },
        });
        advanced++;
      } else {
        // ONCE: deactivate after dispatch.
        await adminDb.reminder.update({
          where: { id: reminder.id },
          data: { active: false },
        });
        advanced++;
      }
    } catch (err) {
      console.error("[reminder] error dispatching", reminder.id, err);
    }
  }

  return { checked: due.length, dispatched, advanced };
}

/** Start the periodic worker. Idempotent. */
export function startReminderWorker(): void {
  if (workerTimer) return;
  console.log("[reminder] worker started — ticking every 60s");
  setTimeout(() => void runTick(), 10_000); // first tick 10s after boot
  workerTimer = setInterval(() => void runTick(), TICK_INTERVAL_MS);
}

async function runTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const result = await tickReminders();
    if (result.dispatched > 0) {
      console.log(`[reminder] tick: checked=${result.checked} dispatched=${result.dispatched} advanced=${result.advanced}`);
    }
  } catch (err) {
    console.error("[reminder] tick failed:", err);
  } finally {
    ticking = false;
  }
}

export function stopReminderWorker(): void {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}
