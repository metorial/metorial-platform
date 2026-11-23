import { describe, expect, it } from 'vitest';
import { queryConcurrencyLimitedError, queryRateLimitedError } from '../src/lib/limits';

describe('query limit errors', () => {
  it('tells the per-minute limit from the concurrency limit', () => {
    let minute = Math.floor(Date.parse('2026-11-14T12:00:45Z') / 60_000);

    expect(
      queryRateLimitedError(minute, Date.parse('2026-11-14T12:00:45Z')).data
    ).toMatchObject({
      status: 429,
      reason: 'query_rate_limit',
      retry_after_seconds: 15
    });
    expect(queryConcurrencyLimitedError().data).toMatchObject({
      status: 429,
      reason: 'query_concurrency_limit',
      retry_after_seconds: 1
    });
  });
});
