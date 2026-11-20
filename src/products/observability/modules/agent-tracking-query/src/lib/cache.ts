import { canonicalize } from '@lowerdeck/canonicalize';
import { isServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { createCachedFunction } from '@metorial/cache';

export let resultTtlSeconds = 60;

export let sessionTtlSeconds = 30;

export let scopeTtlSeconds = 600;

export let catalogTtlSeconds = 3600;

type CachedRead = { key: string; ttlSeconds: number; load: () => Promise<unknown> };

let cachedFunction = createCachedFunction<CachedRead, unknown>({
  name: 'agent-tracking-query/read',
  ttlSeconds: resultTtlSeconds,
  getHash: d => d.key,
  provider: async (d, opts) => {
    opts.setTTL(d.ttlSeconds);

    return await d.load();
  }
});

// canonicalize writes an undefined key as null; the JSON round trip leaves it out.
export let cacheKey = async (d: {
  organizationId: string;
  instanceId: string;
  read: string;
  input?: unknown;
}) => {
  let input = await Hash.sha256(canonicalize(JSON.parse(JSON.stringify(d.input ?? null))));

  return `${d.organizationId}:${d.instanceId}:${d.read}:${input}`;
};

export let cached = async <T>(d: {
  key: string;
  ttlSeconds?: number;
  load: () => Promise<T>;
}) => {
  let loadFailed = false;
  let load = async () => {
    try {
      return await d.load();
    } catch (error) {
      loadFailed = true;
      throw error;
    }
  };

  try {
    return (await cachedFunction({
      key: d.key,
      ttlSeconds: d.ttlSeconds ?? resultTtlSeconds,
      load
    })) as T;
  } catch (error) {
    if (loadFailed || isServiceError(error)) throw error;

    return await d.load();
  }
};
