import { describe, expect, it } from 'vitest';
import {
  calculateRetryDelaySeconds,
  DEFAULT_MAX_RETRY_DELAY_SECONDS,
  DEFAULT_MIN_RETRY_DELAY_SECONDS,
  type RetryType
} from '../retry';

const calcSeries = (type: RetryType, base: number, attempts: number[]) =>
  attempts.map(attempt =>
    calculateRetryDelaySeconds({
      baseDelaySeconds: base,
      attemptNumber: attempt,
      retryType: type
    })
  );

describe('Retry delay calculation', () => {
  it.concurrent.each([
    ['exponential', 10, [1, 2, 3], [10, 20, 40]],
    ['linear', 10, [1, 2, 3], [10, 20, 30]]
  ])('calculates %s backoff', (type, base, attempts, expected) => {
    expect(calcSeries(type as RetryType, base, attempts)).toEqual(expected);
  });

  it('clamps to min and max bounds', () => {
    expect(
      calculateRetryDelaySeconds({
        baseDelaySeconds: 1,
        attemptNumber: 1,
        retryType: 'exponential'
      })
    ).toBe(DEFAULT_MIN_RETRY_DELAY_SECONDS);
    expect(
      calculateRetryDelaySeconds({
        baseDelaySeconds: 3600,
        attemptNumber: 3,
        retryType: 'exponential'
      })
    ).toBe(DEFAULT_MAX_RETRY_DELAY_SECONDS);
  });

  it('exponential grows faster than linear', () => {
    const exp = calculateRetryDelaySeconds({
      baseDelaySeconds: 10,
      attemptNumber: 4,
      retryType: 'exponential'
    });
    const lin = calculateRetryDelaySeconds({
      baseDelaySeconds: 10,
      attemptNumber: 4,
      retryType: 'linear'
    });
    expect(exp).toBeGreaterThan(lin);
  });
});
