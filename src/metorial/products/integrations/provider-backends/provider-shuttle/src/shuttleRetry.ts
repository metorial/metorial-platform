import { isServiceError } from '@lowerdeck/error';
import {
  formatUnknownError,
  retryUntilTimeout,
  type RetryUntilTimeoutContext
} from '@metorial-subspace/retry-utils';

let nonRetryableErrorCodes = new Set([
  'ENOTFOUND',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
]);

let isNonRetryableShuttleError = (error: unknown) => {
  if (isServiceError(error) && error.data?.status && error.data.status < 500) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  let code = (error as { code?: string } | undefined)?.code;
  if (code && nonRetryableErrorCodes.has(code)) {
    return true;
  }

  return false;
};

type ShuttleRetryOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  endpoint?: string;
  logger?: Pick<Console, 'warn'>;
};

export let withShuttleRetry = async <T>(
  fn: () => Promise<T>,
  opts: ShuttleRetryOptions = {}
): Promise<T> => {
  let endpoint = opts.endpoint ?? process.env.SHUTTLE_URL ?? 'unknown';
  let label = `Shuttle not reachable at ${endpoint}`;
  let logger = opts.logger ?? console;

  return retryUntilTimeout({
    fn: async () => await fn(),
    timeoutMs: opts.timeoutMs ?? 30000,
    intervalMs: opts.intervalMs ?? 500,
    label,
    now: opts.now,
    sleep: opts.sleep,
    shouldRetryError: error => !isNonRetryableShuttleError(error),
    onRetry: ctx => {
      if (ctx.reason !== 'error') return;
      logger.warn(
        `[provider-shuttle] Retry ${ctx.attempt} after ${ctx.elapsedMs}ms (${label}): ${formatUnknownError(
          ctx.error
        )}`
      );
    },
    timeoutMessage: (ctx: RetryUntilTimeoutContext<T>) =>
      `${label}. Last error: ${formatUnknownError(ctx.lastError)}`
  });
};
