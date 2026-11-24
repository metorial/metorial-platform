import { describe, expect, it } from 'vitest';
import { applyCheckResult } from '../src/lib/schedule';

let now = new Date('2026-11-20T12:00:00Z');
let hourMs = 60 * 60 * 1000;
let checkIntervalMs = 6 * hourMs;

let run = (
  current: Parameters<typeof applyCheckResult>[0]['current'],
  result: Parameters<typeof applyCheckResult>[0]['result']
) => applyCheckResult({ current, result, now, checkIntervalMs });

let delayOf = (date: Date | null) => (date ? date.getTime() - now.getTime() : null);

describe('applyCheckResult', () => {
  it('marks valid connections and schedules the regular re-check', () => {
    let update = run(
      { status: 'invalid', consecutiveFailures: 3 },
      { outcome: 'valid', modelCount: 12 }
    );

    expect(update).toMatchObject({
      status: 'valid',
      statusMessage: null,
      consecutiveFailures: 0,
      lastValidAt: now
    });
    expect(delayOf(update.nextCheckAt)).toBe(checkIntervalMs);
  });

  it('marks rejected keys invalid and re-checks them daily', () => {
    let update = run(
      { status: 'valid', consecutiveFailures: 0 },
      { outcome: 'invalid', message: 'Incorrect API key', httpStatus: 401 }
    );

    expect(update).toMatchObject({
      status: 'invalid',
      statusMessage: 'Incorrect API key',
      consecutiveFailures: 1
    });
    expect(update.lastValidAt).toBeUndefined();
    expect(delayOf(update.nextCheckAt)).toBe(24 * hourMs);
  });

  it('restarts the invalid count when a connection turns invalid after unreachable checks', () => {
    let update = run({ status: 'valid', consecutiveFailures: 4 }, { outcome: 'invalid' });

    expect(update.consecutiveFailures).toBe(1);
  });

  it('stops probing a key that stayed invalid for a week', () => {
    let update = run({ status: 'invalid', consecutiveFailures: 6 }, { outcome: 'invalid' });

    expect(update.consecutiveFailures).toBe(7);
    expect(update.nextCheckAt).toBeNull();
  });

  it('keeps the status when the provider is unreachable and backs off', () => {
    let first = run({ status: 'valid', consecutiveFailures: 0 }, { outcome: 'unreachable' });
    let third = run({ status: 'valid', consecutiveFailures: 2 }, { outcome: 'unreachable' });

    expect(first.status).toBe('valid');
    expect(first.statusMessage).toBe('The provider could not be reached.');
    expect(delayOf(first.nextCheckAt)).toBe(5 * 60_000);
    expect(delayOf(third.nextCheckAt)).toBe(20 * 60_000);
  });

  it('caps the unreachable backoff at the regular interval', () => {
    let update = run(
      { status: 'pending', consecutiveFailures: 30 },
      { outcome: 'unreachable' }
    );

    expect(update.status).toBe('pending');
    expect(delayOf(update.nextCheckAt)).toBe(checkIntervalMs);
  });
});
