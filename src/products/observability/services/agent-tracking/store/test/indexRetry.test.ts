import { getSentry, setSentry } from '@lowerdeck/sentry';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIndexesWithRetry } from '../src/connection';

let sentry = getSentry();

afterEach(() => {
  vi.restoreAllMocks();
  setSentry(sentry);
});

describe('buildIndexesWithRetry', () => {
  it('retries a failed build with growing waits and stops once it succeeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let build = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('index build already in progress'))
      .mockRejectedValueOnce(new Error('index build already in progress'))
      .mockResolvedValueOnce();
    let waits: number[] = [];

    let built = await buildIndexesWithRetry({
      build,
      attempts: 5,
      baseDelayMs: 100,
      wait: async ms => void waits.push(ms),
      random: () => 0
    });

    expect(built).toBe(true);
    expect(build).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([100, 200]);
  });

  it('reports the failure once after the last attempt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let captureMessage = vi.fn();
    setSentry({ captureMessage } as never);
    let build = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('conflict'));

    let built = await buildIndexesWithRetry({
      build,
      attempts: 3,
      baseDelayMs: 1,
      wait: async () => {}
    });

    expect(built).toBe(false);
    expect(build).toHaveBeenCalledTimes(3);
    expect(captureMessage.mock.calls).toEqual([
      [
        'Agent tracking record store indexes are not in place',
        { level: 'error', extra: { attempts: 3 } }
      ]
    ]);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
