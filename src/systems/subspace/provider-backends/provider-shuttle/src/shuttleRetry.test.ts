import { createError, ServiceError } from '@lowerdeck/error';
import { describe, expect, it, vi } from 'vitest';
import { withShuttleRetry } from './shuttleRetry';

let createServiceError = (status: number, message: string) =>
  new ServiceError(
    createError({
      status,
      code: `status_${status}`,
      message
    })
  );

describe('withShuttleRetry', () => {
  it('retries 5xx errors and eventually succeeds', async () => {
    let warn = vi.fn();
    let attempt = 0;

    let result = await withShuttleRetry(
      async () => {
        attempt += 1;
        if (attempt < 3) {
          throw createServiceError(503, 'temporary outage');
        }
        return 'ok';
      },
      {
        timeoutMs: 5_000,
        intervalMs: 1,
        sleep: async () => undefined,
        logger: { warn },
        endpoint: 'http://shuttle.test'
      }
    );

    expect(result).toBe('ok');
    expect(attempt).toBe(3);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('fails fast on 4xx ServiceError', async () => {
    let warn = vi.fn();
    let error = createServiceError(401, 'unauthorized');
    let attempt = 0;

    await expect(
      withShuttleRetry(
        async () => {
          attempt += 1;
          throw error;
        },
        {
          timeoutMs: 5_000,
          intervalMs: 1,
          sleep: async () => undefined,
          logger: { warn },
          endpoint: 'http://shuttle.test'
        }
      )
    ).rejects.toBe(error);

    expect(attempt).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('fails fast on TypeError without retrying', async () => {
    let warn = vi.fn();
    let error = new TypeError('bad endpoint');
    let attempt = 0;

    await expect(
      withShuttleRetry(
        async () => {
          attempt += 1;
          throw error;
        },
        {
          timeoutMs: 5_000,
          intervalMs: 1,
          sleep: async () => undefined,
          logger: { warn },
          endpoint: 'http://shuttle.test'
        }
      )
    ).rejects.toBe(error);

    expect(attempt).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('times out with a descriptive error after repeated retryable failures', async () => {
    let nowMs = 0;
    let warn = vi.fn();
    let attempt = 0;

    await expect(
      withShuttleRetry(
        async () => {
          attempt += 1;
          throw new Error('temporary network failure');
        },
        {
          timeoutMs: 1_000,
          intervalMs: 250,
          now: () => nowMs,
          sleep: async ms => {
            nowMs += ms;
          },
          logger: { warn },
          endpoint: 'http://shuttle.test'
        }
      )
    ).rejects.toThrow(
      'Shuttle not reachable at http://shuttle.test. Last error: temporary network failure'
    );

    expect(attempt).toBeGreaterThan(1);
    expect(warn).toHaveBeenCalled();
  });
});
