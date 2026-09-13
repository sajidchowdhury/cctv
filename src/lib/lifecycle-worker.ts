/**
 * Lifecycle worker — ticks every 60s, advancing subscriptions to their
 * correct lifecycle status based on time (doc §3.3).
 *
 *   Day 25  → reminder SMS + in-app banner
 *   Day 30  → DUE (unpaid → GRACE)
 *   Day 31–40 → GRACE (daily reminder, "X days to lockout")
 *   Day 41  → LOCKED (modules hidden, login → /payment)
 *
 * Runs as a singleton (one timer per process). Started in instrumentation.ts.
 * Uses the InMemoryQueue adapter from S01 → swap to BullMQ in production.
 */
import { adminDb } from "@/lib/db";
import { advanceSubscription } from "@/lib/subscription";

const TICK_INTERVAL_MS = 60_000; // 1 minute

let workerTimer: NodeJS.Timeout | null = null;
let ticking = false;

/** Advance every subscription based on the current time. */
export async function tickLifecycle(now: Date = new Date()): Promise<{
  checked: number;
  changed: number;
  reminders: number;
}> {
  let checked = 0;
  let changed = 0;
  let reminders = 0;

  // Only check subscriptions that aren't PENDING_ACTIVATION (those need admin verify)
  // OR that are past their cycleEnd (in case a PENDING tenant's trial-equivalent elapsed).
  const subs = await adminDb.subscription.findMany({
    where: {
      OR: [
        { status: { in: ["ACTIVE", "GRACE", "LOCKED"] } },
        { cycleEnd: { lt: now } },
      ],
    },
    select: { tenantId: true, cycleEnd: true, status: true, startedAt: true },
  });

  for (const sub of subs) {
    checked++;
    try {
      const result = await advanceSubscription(
        { ...sub, startedAt: sub.startedAt },
        now
      );
      if (result.changed) changed++;
      if (result.reminderSent) reminders++;
    } catch (err) {
      console.error("[lifecycle] error advancing", sub.tenantId, err);
    }
  }

  return { checked, changed, reminders };
}

/** Start the periodic worker. Idempotent (no-op if already running). */
export function startLifecycleWorker(): void {
  if (workerTimer) return;
  console.log("[lifecycle] worker started — ticking every 60s");
  // First tick shortly after boot (let the server settle).
  setTimeout(() => void runTick(), 5_000);
  workerTimer = setInterval(() => void runTick(), TICK_INTERVAL_MS);
}

async function runTick(): Promise<void> {
  if (ticking) return; // skip overlapping ticks
  ticking = true;
  try {
    const result = await tickLifecycle();
    if (result.changed > 0 || result.reminders > 0) {
      console.log(
        `[lifecycle] tick: checked=${result.checked} changed=${result.changed} reminders=${result.reminders}`
      );
    }
  } catch (err) {
    console.error("[lifecycle] tick failed:", err);
  } finally {
    ticking = false;
  }
}

/** Stop the worker (for tests / shutdown). */
export function stopLifecycleWorker(): void {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}
