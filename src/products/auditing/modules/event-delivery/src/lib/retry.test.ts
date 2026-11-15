import { describe, expect, it } from 'vitest';
import {
  calculateRetryDelaySeconds,
  isRetryableStatusCode,
  MAX_RETRY_DELAY_SECONDS,
  parseRetryAfterSeconds,
  type RetryPolicy
} from './retry';

let policy = (overrides: Partial<RetryPolicy> = {}): RetryPolicy => ({
  retryStrategy: 'exponential',
  retryMaxAttempts: 8,
  retryBaseDelaySeconds: 10,
  retryMaxDelaySeconds: 10800,
  ...overrides
});

describe('isRetryableStatusCode', () => {
  it('retries throttling, timeouts and server errors', () => {
    for (let statusCode of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatusCode(statusCode)).toBe(true);
    }
  });

  it('does not retry a rejection the destination will repeat', () => {
    for (let statusCode of [400, 401, 403, 404, 410, 422]) {
      expect(isRetryableStatusCode(statusCode)).toBe(false);
    }
  });
});

describe('calculateRetryDelaySeconds', () => {
  it('grows exponentially, within the jitter window', () => {
    for (let attemptNumber of [1, 2, 3, 4]) {
      let expected = 10 * 2 ** (attemptNumber - 1);
      let delay = calculateRetryDelaySeconds({ policy: policy(), attemptNumber });

      expect(delay).toBeGreaterThanOrEqual(Math.round(expected / 2));
      expect(delay).toBeLessThanOrEqual(expected);
    }
  });

  it('grows linearly when the strategy says so', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy({ retryStrategy: 'linear' }),
      attemptNumber: 4
    });

    expect(delay).toBeGreaterThanOrEqual(20);
    expect(delay).toBeLessThanOrEqual(40);
  });

  it('stays at the base delay for a fixed strategy', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy({ retryStrategy: 'fixed' }),
      attemptNumber: 6
    });

    expect(delay).toBeGreaterThanOrEqual(5);
    expect(delay).toBeLessThanOrEqual(10);
  });

  it('clamps the backoff to the configured ceiling', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy({ retryMaxDelaySeconds: 60 }),
      attemptNumber: 20
    });

    expect(delay).toBeLessThanOrEqual(60);
  });

  it('honours retry-after over its own backoff curve', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy(),
      attemptNumber: 1,
      retryAfterSeconds: 120
    });

    expect(delay).toBe(120);
  });

  it('does not let retry-after exceed the configured ceiling', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy({ retryMaxDelaySeconds: 60 }),
      attemptNumber: 1,
      retryAfterSeconds: 99999
    });

    expect(delay).toBe(60);
  });

  it('never returns a delay above the hard ceiling', () => {
    let delay = calculateRetryDelaySeconds({
      policy: policy({ retryMaxDelaySeconds: Number.MAX_SAFE_INTEGER }),
      attemptNumber: 25
    });

    expect(delay).toBeLessThanOrEqual(MAX_RETRY_DELAY_SECONDS);
  });
});

describe('parseRetryAfterSeconds', () => {
  it('reads a delay in seconds', () => {
    expect(parseRetryAfterSeconds('30')).toBe(30);
  });

  it('reads an HTTP date', () => {
    let seconds = parseRetryAfterSeconds(new Date(Date.now() + 60_000).toUTCString());

    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThanOrEqual(61);
  });

  it('ignores a missing or unparseable header', () => {
    expect(parseRetryAfterSeconds(null)).toBe(null);
    expect(parseRetryAfterSeconds('soon')).toBe(null);
    expect(parseRetryAfterSeconds('-5')).toBe(null);
  });
});
