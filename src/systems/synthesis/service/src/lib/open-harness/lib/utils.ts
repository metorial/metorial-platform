import type { TokenUsage } from '../agent';
import type { RetryConfig } from '../session';

export function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    /429|500|502|503|504|529/.test(msg) ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('overloaded')
  );
}

export function getRetryDelay(attempt: number, config: RetryConfig, error: Error): number {
  const retryAfter = (error as any).headers?.['retry-after'];
  if (retryAfter) return Math.min(parseInt(retryAfter) * 1000, config.maxDelayMs);

  const base = config.initialDelayMs * config.backoffMultiplier ** attempt;
  const jitter = Math.random() * 0.3 * base;
  return Math.min(base + jitter, config.maxDelayMs);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
    outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
    totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0)
  };
}

export function defaultEstimateTokens(messages: unknown[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}
