import type { EventDeliveryRetryStrategy } from '@metorial/db';

export let MIN_RETRY_DELAY_SECONDS = 1;
export let MAX_RETRY_DELAY_SECONDS = 24 * 60 * 60;
export let MAX_RETRY_ATTEMPTS = 25;

export interface RetryPolicy {
  retryStrategy: EventDeliveryRetryStrategy;
  retryMaxAttempts: number;
  retryBaseDelaySeconds: number;
  retryMaxDelaySeconds: number;
}

let clamp = (value: number, min: number, max: number) => Math.max(Math.min(value, max), min);

// Receivers that reject a delivery on their own terms — auth, validation, a URL that no longer
// exists — will reject every identical retry too, so burning the whole attempt budget on them only
// delays the failure and hammers the receiver. Everything else (transport failures, overload,
// throttling, gateway errors) is assumed transient.
export let isRetryableStatusCode = (statusCode: number) => {
  if (statusCode == 408 || statusCode == 425 || statusCode == 429) return true;
  return statusCode >= 500;
};

export let calculateRetryDelaySeconds = (d: {
  policy: RetryPolicy;
  attemptNumber: number;
  retryAfterSeconds?: number | null;
}) => {
  let maxDelaySeconds = clamp(
    d.policy.retryMaxDelaySeconds,
    MIN_RETRY_DELAY_SECONDS,
    MAX_RETRY_DELAY_SECONDS
  );

  // A receiver that tells us when to come back knows better than our own backoff curve, as long as
  // it stays inside the destination's configured ceiling.
  if (d.retryAfterSeconds != null && Number.isFinite(d.retryAfterSeconds)) {
    return clamp(Math.ceil(d.retryAfterSeconds), MIN_RETRY_DELAY_SECONDS, maxDelaySeconds);
  }

  let baseDelaySeconds = clamp(
    d.policy.retryBaseDelaySeconds,
    MIN_RETRY_DELAY_SECONDS,
    maxDelaySeconds
  );

  let delaySeconds = baseDelaySeconds;
  if (d.policy.retryStrategy == 'exponential') {
    delaySeconds = baseDelaySeconds * 2 ** (d.attemptNumber - 1);
  } else if (d.policy.retryStrategy == 'linear') {
    delaySeconds = baseDelaySeconds * d.attemptNumber;
  }

  delaySeconds = clamp(delaySeconds, MIN_RETRY_DELAY_SECONDS, maxDelaySeconds);

  // Full jitter over the lower half of the window: every delivery that failed in the same tick
  // (a receiver that just went down takes all of them out at once) comes back at a different time
  // instead of re-creating the same spike on the next attempt.
  let jittered = delaySeconds / 2 + Math.random() * (delaySeconds / 2);

  return clamp(Math.round(jittered), MIN_RETRY_DELAY_SECONDS, maxDelaySeconds);
};

export let parseRetryAfterSeconds = (headerValue: string | null | undefined) => {
  if (!headerValue) return null;

  let seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return seconds < 0 ? null : seconds;

  let date = Date.parse(headerValue);
  if (Number.isNaN(date)) return null;

  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
};
