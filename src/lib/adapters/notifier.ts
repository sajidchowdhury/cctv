/**
 * Notification adapters.
 *
 * Production:
 *   Email → Resend
 *
 * Development:
 *   Email → Console
 */

import { Resend } from "resend";

export interface INotifier {
  sendSms(to: string, message: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

/**
 * Console notifier — useful for development/testing.
 */
export class ConsoleNotifier implements INotifier {
  async sendSms(to: string, message: string): Promise<void> {
    console.log(`[SMS → ${to}] ${message}`);
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL → ${to}] ${subject}\n${body}`);
  }
}

/**
 * Resend email notifier — production.
 */
export class ResendNotifier implements INotifier {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    if (!from) {
      throw new Error("EMAIL_FROM is not configured.");
    }

    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async sendSms(to: string, message: string): Promise<void> {
    console.warn(`[SMS NOT CONFIGURED → ${to}] ${message}`);
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject,
      text: body,
    });

    if (error) {
      console.error("[Resend] Email failed:", error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    console.log(
      `[EMAIL → ${to}] sent successfully via Resend`,
      data?.id ? `(id: ${data.id})` : ""
    );
  }
}

let _notifier: INotifier | null = null;

export function getNotifier(): INotifier {
  if (!_notifier) {
    const provider = (process.env.EMAIL_PROVIDER || "console")
      .trim()
      .toLowerCase();

    if (provider === "resend") {
      _notifier = new ResendNotifier();
    } else {
      _notifier = new ConsoleNotifier();
    }
  }

  return _notifier;
}
