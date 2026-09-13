/**
 * Subscription lifecycle (doc §3.3).
 *
 * The deterministic state machine that prevents a tenant from silently
 * falling overdue. A 30-day cycle anchored to the subscription start date:
 *
 *   Day 1        → ACTIVE       (after admin verifies first payment)
 *   Day 25       → REMINDER     (bill-due reminder SMS + in-app banner)
 *   Day 30       → DUE          (unpaid → enters GRACE; paid+verified → next cycle)
 *   Day 31–40    → GRACE        (full access, daily reminder, "X days to lockout")
 *   Day 41       → LOCKED       (all modules hidden, login lands on /payment)
 *   On verify    → ACTIVE       (cycle_end += 30 days, access restored instantly)
 *
 * This module is the single source of truth — used by:
 *   - the lifecycle worker (checks every minute)
 *   - the admin verify endpoint (extends cycle_end +30d)
 *   - the tenant billing API (reads current status)
 */
import { adminDb } from "@/lib/db";
import { getNotifier } from "@/lib/adapters/notifier";

export type LifecycleStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "GRACE"
  | "LOCKED";

/** Days into the cycle that trigger each stage (doc §3.3). */
export const REMINDER_DAY = 25;
export const DUE_DAY = 30;
export const LOCK_DAY = 40; // 10 days past DUE

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 30;

/**
 * Compute the lifecycle status for a subscription based on the current time
 * relative to cycleEnd. Pure function — no DB writes.
 *
 * Rule: cycleEnd is the anchor. Today vs cycleEnd:
 *   today < cycleEnd - 5d   → ACTIVE
 *   today >= cycleEnd - 5d  AND today < cycleEnd → ACTIVE (reminder fires)
 *   today >= cycleEnd       AND today < cycleEnd + 10d → GRACE
 *   today >= cycleEnd + 10d → LOCKED
 */
export function computeStatus(
  cycleEnd: Date,
  now: Date = new Date(),
  current: LifecycleStatus = "ACTIVE"
): LifecycleStatus {
  // PENDING_ACTIVATION is only cleared by an admin verify — never auto.
  if (current === "PENDING_ACTIVATION") return "PENDING_ACTIVATION";

  const diff = cycleEnd.getTime() - now.getTime(); // ms until cycleEnd
  if (diff > 0) {
    // Still within the cycle.
    return "ACTIVE";
  }
  // Past cycleEnd → grace for 10 days, then locked.
  const overdueDays = Math.floor(-diff / DAY_MS);
  if (overdueDays < LOCK_DAY - DUE_DAY) {
    return "GRACE";
  }
  return "LOCKED";
}

/** Days until the next lifecycle milestone (for UI countdown). */
export function daysToLockout(cycleEnd: Date, now: Date = new Date()): number | null {
  const lockAt = new Date(cycleEnd.getTime() + (LOCK_DAY - DUE_DAY) * DAY_MS);
  const diff = lockAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

/**
 * Advance a single subscription to its correct status based on time.
 * Sends reminders/SMS where due. Returns the (possibly new) status.
 */
export async function advanceSubscription(sub: {
  tenantId: string;
  cycleEnd: Date;
  status: string;
  startedAt: Date;
}, now: Date = new Date()): Promise<{
  status: LifecycleStatus;
  changed: boolean;
  reminderSent: boolean;
}> {
  const computed = computeStatus(sub.cycleEnd, now, sub.status as LifecycleStatus);

  // If status changed, persist it.
  if (computed !== sub.status) {
    const data: any = { status: computed };
    if (computed === "LOCKED") data.lockedAt = now;
    if (computed === "ACTIVE") data.lockedAt = null;

    await adminDb.subscription.update({
      where: { tenantId: sub.tenantId },
      data,
    });

    // Also sync the tenant.status for the proxy gate + dashboard.
    await adminDb.tenant.update({
      where: { id: sub.tenantId },
      data: { status: computed },
    });

    // SMS the owner on lock (doc §3.3 day 41).
    if (computed === "LOCKED") {
      const tenant = await adminDb.tenant.findUnique({
        where: { id: sub.tenantId },
        select: { phone: true, name: true, ownerEmail: true },
      });
      if (tenant?.phone) {
        const notifier = getNotifier();
        await notifier.sendSms(
          tenant.phone,
          `Your CCTV Inventory SaaS account is locked. Submit payment at ${process.env.NEXTAUTH_URL ?? "the app"}/payment to restore access.`
        );
      }
    }
    return { status: computed, changed: true, reminderSent: false };
  }

  // Status unchanged — fire the day-25 reminder if within the reminder window.
  const diffDays = Math.floor(
    (sub.cycleEnd.getTime() - now.getTime()) / DAY_MS
  );
  let reminderSent = false;
  if (
    computed === "ACTIVE" &&
    diffDays <= REMINDER_DAY &&
    diffDays >= 0 &&
    !subReminderAlreadySent(sub.tenantId, now)
  ) {
    const tenant = await adminDb.tenant.findUnique({
      where: { id: sub.tenantId },
      select: { phone: true, name: true },
    });
    if (tenant?.phone) {
      const notifier = getNotifier();
      await notifier.sendSms(
        tenant.phone,
        `Reminder: your CCTV Inventory SaaS subscription renews in ${diffDays} day(s). Submit payment to avoid lockout.`
      );
      reminderSent = true;
      markReminderSent(sub.tenantId, now);
    }
  }

  // GRACE daily reminder (day 31–40).
  if (computed === "GRACE" && !subReminderAlreadySent(sub.tenantId, now)) {
    const daysLeft = daysToLockout(sub.cycleEnd, now) ?? 0;
    const tenant = await adminDb.tenant.findUnique({
      where: { id: sub.tenantId },
      select: { phone: true },
    });
    if (tenant?.phone) {
      const notifier = getNotifier();
      await notifier.sendSms(
        tenant.phone,
        `Your subscription is in grace. ${daysLeft} day(s) to lockout. Submit payment now.`
      );
      reminderSent = true;
      markReminderSent(sub.tenantId, now);
    }
  }

  return { status: computed, changed: false, reminderSent };
}

/**
 * Verify a payment (admin action) — extends cycle_end by 30 days and lifts
 * any lock. First verification transitions PENDING_ACTIVATION → ACTIVE.
 *
 * Returns the new cycleEnd.
 */
export async function verifyPayment(
  paymentVerificationId: string,
  verifiedBy: string
): Promise<{ cycleEnd: Date; status: LifecycleStatus }> {
  const pv = await adminDb.paymentVerification.findUnique({
    where: { id: paymentVerificationId },
    include: { tenant: { include: { subscription: true } } },
  });
  if (!pv || pv.status !== "PENDING") {
    throw new Error("Payment verification not found or already processed.");
  }
  const sub = pv.tenant.subscription;
  if (!sub) throw new Error("Tenant has no subscription record.");

  const now = new Date();
  // Extend from max(now, current cycleEnd) so a renewal can't be back-dated.
  const base = sub.cycleEnd.getTime() > now.getTime() ? sub.cycleEnd : now;
  const newCycleEnd = new Date(base.getTime() + CYCLE_DAYS * DAY_MS);

  await adminDb.$transaction([
    adminDb.paymentVerification.update({
      where: { id: paymentVerificationId },
      data: {
        status: "VERIFIED",
        verifiedBy,
        verifiedAt: now,
      },
    }),
    adminDb.subscription.update({
      where: { tenantId: pv.tenantId },
      data: {
        status: "ACTIVE",
        cycleEnd: newCycleEnd,
        lockedAt: null,
      },
    }),
    adminDb.tenant.update({
      where: { id: pv.tenantId },
      data: { status: "ACTIVE" },
    }),
  ]);

  // SMS the owner: "Subscription renewed until DD-MM-YYYY. Thank you."
  const tenant = await adminDb.tenant.findUnique({
    where: { id: pv.tenantId },
    select: { phone: true, name: true },
  });
  if (tenant?.phone) {
    const notifier = getNotifier();
    const until = newCycleEnd.toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    await notifier.sendSms(
      tenant.phone,
      `Subscription renewed until ${until}. Thank you.`
    );
  }

  return { cycleEnd: newCycleEnd, status: "ACTIVE" };
}

/**
 * Reject a payment (admin action) — requires a reason. SMS the user to retry.
 */
export async function rejectPayment(
  paymentVerificationId: string,
  verifiedBy: string,
  reason: string
): Promise<void> {
  const pv = await adminDb.paymentVerification.findUnique({
    where: { id: paymentVerificationId },
    include: { tenant: { select: { phone: true } } },
  });
  if (!pv || pv.status !== "PENDING") {
    throw new Error("Payment verification not found or already processed.");
  }

  await adminDb.paymentVerification.update({
    where: { id: paymentVerificationId },
    data: {
      status: "REJECTED",
      verifiedBy,
      verifiedAt: new Date(),
      rejectionReason: reason,
    },
  });

  if (pv.tenant?.phone) {
    const notifier = getNotifier();
    await notifier.sendSms(
      pv.tenant.phone,
      `Your payment submission was rejected: ${reason}. Please retry with the correct transaction ID.`
    );
  }
}

// ─── Reminder dedup (in-process, resets on restart) ───────────────────────
// Sends at most one reminder per tenant per calendar day. Good enough for
// the in-memory dev worker; S22 replaces this with the persistent reminders table.
const reminderLog = new Map<string, string>(); // tenantId → YYYY-MM-DD

function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
function subReminderAlreadySent(tenantId: string, now: Date = new Date()): boolean {
  return reminderLog.get(tenantId) === todayKey(now);
}
function markReminderSent(tenantId: string, now: Date = new Date()): void {
  reminderLog.set(tenantId, todayKey(now));
}
