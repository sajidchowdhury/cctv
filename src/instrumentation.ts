/**
 * instrumentation.ts — runs once on server boot (Next.js convention).
 *
 * Starts:
 *   1. Subscription-lifecycle worker (S05) — day-25 reminders, day-30 grace,
 *      day-41 lockouts (doc §3.3).
 *   2. Reminder engine worker (S22) — hourly check for due reminders,
 *      dispatches SMS/in-app + advances nextDue (doc §5.5).
 */
export async function register() {
  // Only run on the server (not during build / edge).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLifecycleWorker } = await import("@/lib/lifecycle-worker");
    const { startReminderWorker } = await import("@/lib/reminder-worker");
    startLifecycleWorker();
    startReminderWorker();
  }
}
