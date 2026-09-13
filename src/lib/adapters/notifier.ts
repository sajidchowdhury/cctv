/**
 * INotifier — notification adapter (doc §2 stack, §3.3 lifecycle SMS, §5.5 reminders).
 *
 * Production: Resend (email) + SSL Wireless / Twilio (SMS).
 * Dev build: ConsoleNotifier (logs to stdout).
 */

export interface INotifier {
  /** Send an SMS to a phone number (BD format: 01XXXXXXXXX). */
  sendSms(to: string, message: string): Promise<void>;
  /** Send a transactional email. */
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

/**
 * Console notifier — logs notifications to stdout for dev.
 * Swap for Resend/Twilio in production (one env var).
 */
export class ConsoleNotifier implements INotifier {
  async sendSms(to: string, message: string): Promise<void> {
    console.log(`[SMS → ${to}] ${message}`);
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL → ${to}] ${subject}\n${body}`);
  }
}

let _notifier: INotifier | null = null;

export function getNotifier(): INotifier {
  if (!_notifier) {
    _notifier = new ConsoleNotifier();
  }
  return _notifier;
}
