export type BackoffStrategy = 'linear' | 'exponential';

export interface FetchRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  backoffStrategy?: BackoffStrategy;
  respectRateLimitReset?: boolean;
}

