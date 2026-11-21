import type { ProviderConnectionStatus } from '@mtsrc/ai-gateway-db';
import type { ConnectionCheckResult } from '@mtsrc/ai-gateway-spec';

let minuteMs = 60_000;
let hourMs = 60 * minuteMs;

let unreachableBaseDelayMs = 5 * minuteMs;
let invalidRecheckMs = 24 * hourMs;

// A key that keeps failing authentication is almost always revoked for good; after a week of daily
// checks it waits for the customer to update it instead of being probed forever.
let maxInvalidChecks = 7;

export type ConnectionCheckState = {
  status: ProviderConnectionStatus;
  consecutiveFailures: number;
};

export type ConnectionCheckUpdate = {
  status: ProviderConnectionStatus;
  statusMessage: string | null;
  consecutiveFailures: number;
  lastCheckedAt: Date;
  lastValidAt?: Date;
  nextCheckAt: Date | null;
};

export let applyCheckResult = (d: {
  current: ConnectionCheckState;
  result: ConnectionCheckResult;
  now: Date;
  checkIntervalMs: number;
}): ConnectionCheckUpdate => {
  let at = (delayMs: number) => new Date(d.now.getTime() + delayMs);

  if (d.result.outcome == 'valid') {
    return {
      status: 'valid',
      statusMessage: null,
      consecutiveFailures: 0,
      lastCheckedAt: d.now,
      lastValidAt: d.now,
      nextCheckAt: at(d.checkIntervalMs)
    };
  }

  if (d.result.outcome == 'invalid') {
    let failures = d.current.status == 'invalid' ? d.current.consecutiveFailures + 1 : 1;

    return {
      status: 'invalid',
      statusMessage: d.result.message ?? 'The provider rejected the credentials.',
      consecutiveFailures: failures,
      lastCheckedAt: d.now,
      nextCheckAt: failures >= maxInvalidChecks ? null : at(invalidRecheckMs)
    };
  }

  // The provider could not be reached, so nothing was learned about the key: the status stays
  // as it was and the check is retried with backoff, capped at the regular interval.
  let failures = d.current.consecutiveFailures + 1;
  let backoffMs = Math.min(unreachableBaseDelayMs * 2 ** (failures - 1), d.checkIntervalMs);

  return {
    status: d.current.status,
    statusMessage: d.result.message ?? 'The provider could not be reached.',
    consecutiveFailures: failures,
    lastCheckedAt: d.now,
    nextCheckAt: at(backoffMs)
  };
};
