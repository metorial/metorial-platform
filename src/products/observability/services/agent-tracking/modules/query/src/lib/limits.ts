import { ServiceError, tooManyRequestsError } from '@lowerdeck/error';

export let maxConcurrentQueries = 4;

export let maxQueriesPerMinute = 60;

export let queryRateLimitedError = (minute: number, now: number = Date.now()) =>
  new ServiceError(
    tooManyRequestsError({
      message: `At most ${maxQueriesPerMinute} queries per minute.`,
      reason: 'query_rate_limit',
      retry_after_seconds: Math.max(1, Math.ceil(((minute + 1) * 60_000 - now) / 1000))
    })
  );

export let queryConcurrencyLimitedError = () =>
  new ServiceError(
    tooManyRequestsError({
      message: `At most ${maxConcurrentQueries} queries can run at once.`,
      reason: 'query_concurrency_limit',
      retry_after_seconds: 1
    })
  );
