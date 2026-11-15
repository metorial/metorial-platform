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

// Atomically hands out evenly spaced request slots. Returns the wait in milliseconds, or -1
// without reserving anything when the wait would exceed the caller's limit.
let RESERVE_SLOT_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local interval = tonumber(ARGV[1])
local maxWait = tonumber(ARGV[2])

local nextSlot = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, nextSlot)
local wait = slot - now

if wait > maxWait then return -1 end

redis.call('SET', KEYS[1], tostring(slot + interval), 'PX', math.ceil(wait + interval * 2 + 60000))
return wait
`;

export type RedisScriptRunner = (d: {
  script: string;
  key: string;
  args: number[];
}) => Promise<unknown>;

// Shares request slots between every process that talks to the same Redis. When Redis is
// unavailable the limiter lets requests through rather than stalling the agents.
export let createRedisRateLimiter = (d: {
  keyPrefix: string;
  runScript: RedisScriptRunner;
  onError?: (error: unknown) => void;
}): ReviewRateLimiter => ({
  reserve: async r => {
    try {
      let wait = Number(
        await d.runScript({
          script: RESERVE_SLOT_SCRIPT,
          key: `${d.keyPrefix}${r.key}`,
          args: [
            r.intervalMs,
            Number.isFinite(r.maxWaitMs) ? r.maxWaitMs : Number.MAX_SAFE_INTEGER
          ]
        })
      );

      return wait < 0 ? null : wait;
    } catch (error) {
      d.onError?.(error);
      return 0;
    }
  }
});

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
