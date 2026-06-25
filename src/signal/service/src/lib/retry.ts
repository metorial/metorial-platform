import { clamp } from './clamp';

export type RetryType = 'linear' | 'exponential';

export const DEFAULT_MIN_RETRY_DELAY_SECONDS = 10;
export const DEFAULT_MAX_RETRY_DELAY_SECONDS = 60 * 60 * 3;

export const calculateRetryDelaySeconds = (d: {
  baseDelaySeconds: number;
  attemptNumber: number;
  retryType: RetryType;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
}) => {
  const minDelaySeconds = d.minDelaySeconds ?? DEFAULT_MIN_RETRY_DELAY_SECONDS;
  const maxDelaySeconds = d.maxDelaySeconds ?? DEFAULT_MAX_RETRY_DELAY_SECONDS;

  let delaySeconds = d.baseDelaySeconds;
  if (d.retryType === 'exponential') {
    delaySeconds = delaySeconds * 2 ** (d.attemptNumber - 1);
  } else if (d.retryType === 'linear') {
    delaySeconds = delaySeconds * d.attemptNumber;
  }

  return clamp(delaySeconds, {
    min: minDelaySeconds,
    max: maxDelaySeconds
  });
};
