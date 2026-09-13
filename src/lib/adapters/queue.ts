/**
 * IQueue — background job queue adapter (doc §2 stack, §5.5 reminder engine).
 *
 * Production: Redis 7 + BullMQ.
 * Dev build: InMemoryQueue (process-level worker).
 *
 * Swappable behind an interface so production swaps to Redis with zero
 * business-logic changes (architecture rule, IMPLEMENTATION_PLAN §2).
 */

export interface QueueJob {
  type: string;
  payload: Record<string, unknown>;
  runAt?: Date; // when to execute (default: immediately)
}

export type QueueHandler = (job: QueueJob) => Promise<void>;

export interface IQueue {
  /** Enqueue a job for later or immediate processing. */
  enqueue(job: QueueJob): Promise<void>;
  /** Register a handler for a job type. Starts polling. */
  process(handler: QueueHandler): void;
}

/**
 * In-memory queue with a polling worker.
 * Suitable for dev; not durable across restarts.
 */
export class InMemoryQueue implements IQueue {
  private jobs: QueueJob[] = [];
  private handler: QueueHandler | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 60_000; // doc §5.5: hourly check

  async enqueue(job: QueueJob): Promise<void> {
    this.jobs.push(job);
  }

  process(handler: QueueHandler): void {
    this.handler = handler;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.handler) return;
    const now = Date.now();
    const due = this.jobs.filter(
      (j) => !j.runAt || j.runAt.getTime() <= now
    );
    this.jobs = this.jobs.filter((j) => !due.includes(j));
    for (const job of due) {
      try {
        await this.handler(job);
      } catch (err) {
        console.error("[queue] job failed", job.type, err);
      }
    }
  }

  /** Stop the worker (for tests / shutdown). */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Active queue instance (singleton).
 * S05 wires the subscription-lifecycle worker; S22 wires the reminder engine.
 */
let _queue: IQueue | null = null;

export function getQueue(): IQueue {
  if (!_queue) {
    _queue = new InMemoryQueue();
  }
  return _queue;
}
