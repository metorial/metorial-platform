import { eventually, type EventuallyOptions } from '@lowerdeck/testing-tools';
import { isRemoteE2E } from './env';

export interface TriggerableCron {
  trigger: () => Promise<unknown>;
}

let AUDIT_COLLECTOR_CRON = 'audit/event/collect';

let AUDIT_OPTIONS = { timeoutMs: 150_000, intervalMs: 500 };

/**
 * `eventually` for effects a cron produces. After every failed attempt the crons are asked to
 * run now rather than at their next scheduled minute. The schedule stays in place, so a trigger
 * that is lost or lands too early only costs time, never the result.
 */
export let eventuallyWithCron = async <T>(
  crons: TriggerableCron | TriggerableCron[],
  fn: () => T | Promise<T>,
  options: EventuallyOptions = {}
): Promise<T> => {
  let triggers = [crons].flat();

  return await eventually(async () => {
    try {
      return await fn();
    } catch (error) {
      await Promise.allSettled(triggers.map(cron => cron.trigger()));
      throw error;
    }
  }, options);
};

/** A remote stack's Redis is out of reach, so there the collector only runs on its schedule. */
let auditCollectorCron: TriggerableCron = {
  trigger: async () => {
    if (isRemoteE2E()) return;

    let { triggerCron } = await import('@metorial/cron');
    await triggerCron(AUDIT_COLLECTOR_CRON);
  }
};

/** `eventually` for audit log entries, which reach the audit log through the collector cron. */
export let eventuallyAudited = async <T>(
  fn: () => T | Promise<T>,
  options: EventuallyOptions = {}
): Promise<T> =>
  await eventuallyWithCron(auditCollectorCron, fn, { ...AUDIT_OPTIONS, ...options });
