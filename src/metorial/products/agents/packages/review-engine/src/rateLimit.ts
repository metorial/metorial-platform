import type { ReviewModel } from './model';

export type ReviewRateLimiter = {
  // Reserves the next request slot for `key` and returns how long the caller has to wait for it,
  // or null (reserving nothing) when that wait would exceed `maxWaitMs`.
  reserve(d: { key: string; intervalMs: number; maxWaitMs: number }): Promise<number | null>;
};

export type ReviewModelAccess = {
  limiter: ReviewRateLimiter;
  maxWaitMs: number;
};

export let createMemoryRateLimiter = (now: () => number = Date.now): ReviewRateLimiter => {
  let nextSlots = new Map<string, number>();

  return {
    reserve: async d => {
      let current = now();
      let slot = Math.max(current, nextSlots.get(d.key) ?? 0);
      let wait = slot - current;

      if (wait > d.maxWaitMs) return null;

      nextSlots.set(d.key, slot + d.intervalMs);
      return wait;
    }
  };
};

let sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    let onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    let timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });

// Walks the fallback chain and returns the first model whose rate limit has a free slot within
// the wait timeout. The last model in the chain always waits for its slot.
export let acquireReviewModel = async (d: {
  model: ReviewModel;
  access?: ReviewModelAccess;
  signal?: AbortSignal;
  onFallback?: (d: { from: ReviewModel; to: ReviewModel }) => void;
}): Promise<ReviewModel> => {
  let candidate = d.model;

  while (true) {
    if (!candidate.requestsPerMinute || !d.access) return candidate;

    let next = candidate.fallback;
    let wait = await d.access.limiter.reserve({
      key: candidate.slug,
      intervalMs: 60_000 / candidate.requestsPerMinute,
      maxWaitMs: next ? d.access.maxWaitMs : Infinity
    });

    if (wait !== null) {
      if (wait > 0) await sleep(wait, d.signal);
      return candidate;
    }

    d.onFallback?.({ from: candidate, to: next! });
    candidate = next!;
  }
};
