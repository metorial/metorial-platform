import { delay } from '@lowerdeck/delay';

type RetryReason = 'empty_result' | 'error';

export type RetryUntilTimeoutContext<T> = {
  label: string;
  attempt: number;
  elapsedMs: number;
  timeoutMs: number;
  lastError: unknown;
  lastResult: T | null;
};

type RetryUntilTimeoutOptions<T> = {
  fn: (attempt: number) => Promise<T | null>;
  timeoutMs: number;
  intervalMs: number;
  label: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetryError?: (error: unknown, context: RetryUntilTimeoutContext<T>) => boolean;
  onRetry?: (
    context: RetryUntilTimeoutContext<T> & { reason: RetryReason; error?: unknown }
  ) => void;
  onTimeout?: (context: RetryUntilTimeoutContext<T>) => T | Promise<T>;
  timeoutMessage?: (context: RetryUntilTimeoutContext<T>) => string;
};

export let formatUnknownError = (value: unknown) => {
  if (value instanceof Error) return value.message;
  return String(value);
};

export let retryUntilTimeout = async <T>(opts: RetryUntilTimeoutOptions<T>): Promise<T> => {
  let now = opts.now ?? Date.now;
  let sleep = opts.sleep ?? delay;

  let start = now();
  let attempt = 0;
  let lastError: unknown;
  let lastResult: T | null = null;

  let context = (): RetryUntilTimeoutContext<T> => ({
    label: opts.label,
    attempt,
    elapsedMs: now() - start,
    timeoutMs: opts.timeoutMs,
    lastError,
    lastResult
  });

  while (true) {
    attempt += 1;

    try {
      let result = await opts.fn(attempt);
      if (result !== null) return result;
      lastResult = result;
      opts.onRetry?.({
        ...context(),
        reason: 'empty_result'
      });
    } catch (error) {
      lastError = error;
      let shouldRetry = opts.shouldRetryError?.(error, context()) ?? true;
      if (!shouldRetry) throw error;

      opts.onRetry?.({
        ...context(),
        reason: 'error',
        error
      });
    }

    if (now() - start > opts.timeoutMs) {
      let timeoutContext = context();
      if (opts.onTimeout) {
        return await opts.onTimeout(timeoutContext);
      }

      let message =
        opts.timeoutMessage?.(timeoutContext) ??
        (lastError
          ? `${opts.label}. Last error: ${formatUnknownError(lastError)}`
          : `${opts.label}. Timed out after ${opts.timeoutMs}ms`);
      throw new Error(message);
    }

    await sleep(opts.intervalMs);
  }
};
