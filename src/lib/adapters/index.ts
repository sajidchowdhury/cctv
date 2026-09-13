/**
 * Adapter barrel — production-swappable infrastructure interfaces.
 *
 * Swap targets (doc §2):
 *   queue    → Redis 7 + BullMQ
 *   storage  → Cloudflare R2 / MinIO (S3-compatible)
 *   notifier → Resend (email) + SSL Wireless / Twilio (SMS)
 */
export { getQueue, InMemoryQueue } from "./queue";
export type { IQueue, QueueJob, QueueHandler } from "./queue";

export { getStorage, LocalStorageDriver } from "./storage";
export type { IStorage, UploadResult } from "./storage";

export { getNotifier, ConsoleNotifier } from "./notifier";
export type { INotifier } from "./notifier";
