/**
 * Formatting utilities — Bangladesh-specific (doc §6).
 *
 * - Money: BDT, 2 decimals, ৳ symbol.
 * - Dates: stored UTC, displayed in Asia/Dhaka (Asia/Dhaka = UTC+6).
 */

const BDT_SYMBOL = "\u09F3"; // ৳

/**
 * Format a number as BDT currency: ৳1,234.50
 */
export function formatBDT(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${BDT_SYMBOL}${formatted}`;
}

/**
 * Parse a BDT-formatted string back to a number.
 * Tolerates the ৳ symbol, commas, and whitespace.
 */
export function parseBDT(value: string): number {
  const cleaned = value.replace(/[৳,\s]/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Format a date for display in Asia/Dhaka timezone.
 */
export function formatDate(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts,
  }).format(d);
}

/**
 * Format a date+time for display in Asia/Dhaka timezone.
 */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
