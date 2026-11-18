import { eventually, type EventuallyOptions } from '@lowerdeck/testing-tools';
import { isRemoteE2E } from './env';

export interface TriggerableCron {
  trigger: () => Promise<unknown>;
}

export type EventuallyWithCronOptions = EventuallyOptions & {
  triggerIntervalMs?: number;
  triggerTimeoutMs?: number;
};

let AUDIT_COLLECTOR_CRON = 'audit/event/collect';

let TRIGGER_INTERVAL_MS = 3000;
let TRIGGER_TIMEOUT_MS = 5000;

let AUDIT_OPTIONS = { timeoutMs: 150_000, intervalMs: 500, triggerIntervalMs: 500 };

let triggerFailureReported = false;

let withTimeout = async (trigger: () => Promise<unknown>, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      trigger(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Cron trigger timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};

let triggerAll = async (crons: TriggerableCron[], timeoutMs: number) => {
  let results = await Promise.allSettled(
    crons.map(cron => withTimeout(() => cron.trigger(), timeoutMs))
  );

  let failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (!failure || triggerFailureReported) return;

  triggerFailureReported = true;
  console.warn(
    '[e2e] A cron trigger failed, waiting for the schedule instead:',
    failure.reason
  );
};

/**
 * `eventually` for effects a cron produces. After a failed attempt the crons are asked to run
 * now rather than at their next scheduled minute. The schedule stays in place, so a trigger
 * that is lost, hangs or lands too early only costs time, never the result.
 *
 * Triggers are at least `triggerIntervalMs` apart: a cron that fans out one job per item must
 * not run again while those jobs are in flight, or every item is queued a second time.
 */
export let eventuallyWithCron = async <T>(
  crons: TriggerableCron | TriggerableCron[],
  fn: () => T | Promise<T>,
  options: EventuallyWithCronOptions = {}
): Promise<T> => {
  let {
    triggerIntervalMs = TRIGGER_INTERVAL_MS,
    triggerTimeoutMs = TRIGGER_TIMEOUT_MS,
    ...eventuallyOptions
  } = options;
  let triggers = [crons].flat();
  let triggeredAt = Number.NEGATIVE_INFINITY;

  return await eventually(async () => {
    try {
      return await fn();
    } catch (error) {
      if (Date.now() - triggeredAt >= triggerIntervalMs) {
        triggeredAt = Date.now();
        await triggerAll(triggers, triggerTimeoutMs);
      }

      throw error;
    }
  }, eventuallyOptions);
};

/** A remote stack's Redis is out of reach, so there the collector only runs on its schedule. */
let auditCollectorCron: TriggerableCron = {
  trigger: async () => {
    if (isRemoteE2E()) return;

    let { triggerCron } = await import('@metorial/cron');
    await triggerCron(AUDIT_COLLECTOR_CRON);
  }
};

/**
 * `eventually` for audit log entries, which reach the audit log through the collector cron.
 * Collecting is idempotent, so the collector is triggered on every attempt.
 */
export let eventuallyAudited = async <T>(
  fn: () => T | Promise<T>,
  options: EventuallyWithCronOptions = {}
): Promise<T> =>
  await eventuallyWithCron(auditCollectorCron, fn, { ...AUDIT_OPTIONS, ...options });
