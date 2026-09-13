/**
 * instrumentation.ts — runs once on server boot (Next.js convention).
 *
 * Starts the subscription-lifecycle worker so day-25 reminders, day-30 grace,
 * and day-41 lockouts fire automatically (doc §3.3).
 */
export async function register() {
  // Only run on the server (not during build / edge).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLifecycleWorker } = await import("@/lib/lifecycle-worker");
    startLifecycleWorker();
  }
}
