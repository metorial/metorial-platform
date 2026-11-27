import {
  createError,
  isServiceError,
  ServiceError,
  tooManyRequestsError
} from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';

export let queryCallOptions = { timeoutMs: 15_000, retry: false, captureErrors: false };

export let readCallOptions = { timeoutMs: 5_000, retry: false, captureErrors: false };

// Only the service's concurrency limit clears within moments, so only it is retried.
let concurrencyRetries = 2;

let concurrencyRetryAfterSeconds = 2;

let agentTrackingUnavailableError = createError({
  status: 503,
  code: 'service_unavailable',
  message: 'Agent tracking cannot answer right now.',
  hint: 'Try again in a moment.'
});

let statusOf = (error: unknown) => (isServiceError(error) ? Number(error.data.status) : null);

let isConcurrencyLimited = (error: unknown) =>
  statusOf(error) == 429 &&
  (error as ServiceError<any>).data.reason == 'query_concurrency_limit';

export let retryAfterSeconds = (now: Date = new Date()) =>
  Math.max(1, 60 - now.getUTCSeconds());

let tooManyRequests = (seconds: number) =>
  new ServiceError(
    tooManyRequestsError({
      message: 'Agent tracking is answering too many requests for this organization.',
      hint: `Try again in ${seconds} second${seconds == 1 ? '' : 's'}.`,
      retry_after_seconds: seconds
    })
  );

export let translateServiceError = (error: unknown, now: Date = new Date()) => {
  let status = statusOf(error);
  if (status === null) return error;

  if (status == 429) {
    if (isConcurrencyLimited(error)) return tooManyRequests(concurrencyRetryAfterSeconds);

    let reported = Number((error as ServiceError<any>).data.retry_after_seconds);
    return tooManyRequests(
      Number.isFinite(reported) && reported > 0 ? Math.ceil(reported) : retryAfterSeconds(now)
    );
  }

  if (status >= 500) return new ServiceError(agentTrackingUnavailableError);

  return error;
};

let jitteredDelay = () =>
  new Promise(resolve => setTimeout(resolve, 250 + Math.floor(Math.random() * 500)));

export let fromService = async <T>(run: () => Promise<T>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (isConcurrencyLimited(error) && attempt < concurrencyRetries) {
        await jitteredDelay();
        continue;
      }

      throw translateServiceError(error);
    }
  }
};

export let failSoft = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch (error) {
    if (!isServiceError(error)) getSentry().captureException(error);

    return fallback;
  }
};
