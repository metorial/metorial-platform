import { createCachedFunction } from '@lowerdeck/cache';
import { env } from '../env';

type Compute<T> = (setTTL: (seconds: number) => void) => Promise<T>;

// Get-or-compute over Redis that degrades to a plain call when Redis is unreachable. `cached` is
// false only for the caller whose compute ran, so a deduplicated concurrent caller sees `true`.
export let createMemo = <T>(d: {
  name: string;
  ttlSeconds: number;
  isComputeError: (error: unknown) => boolean;
}) => {
  let cachedFunction = createCachedFunction<{ key: string; compute: Compute<T> }, T>({
    name: d.name,
    redisUrl: env.service.REDIS_URL,
    ttlSeconds: d.ttlSeconds,
    getHash: i => i.key,
    provider: async (i, { setTTL }) => await i.compute(setTTL)
  });

  return async (key: string, compute: Compute<T>): Promise<{ value: T; cached: boolean }> => {
    let state: { computed: boolean; result?: T } = { computed: false };

    try {
      let value = await cachedFunction({
        key,
        compute: async setTTL => {
          state.computed = true;
          state.result = await compute(setTTL);
          return state.result;
        }
      });

      return { value, cached: !state.computed };
    } catch (error) {
      if (state.result !== undefined) return { value: state.result, cached: false };
      if (state.computed || d.isComputeError(error)) throw error;

      console.warn(`[ai-gateway] ${d.name} cache unavailable`, error);
      return { value: await compute(() => {}), cached: false };
    }
  };
};
