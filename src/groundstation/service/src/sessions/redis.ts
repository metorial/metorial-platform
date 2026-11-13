import { Redis } from 'ioredis';
import { env } from '../env';

let commandTimeoutMs = 1000;

let client: Redis | undefined;

export let getSessionRedis = () =>
  (client ??= new Redis(env.service.REDIS_URL, {
    lazyConnect: true,
    commandTimeout: commandTimeoutMs,
    maxRetriesPerRequest: 1
  }));

export let closeSessionRedis = async () => {
  if (!client) return;

  let current = client;
  client = undefined;
  await current.quit().catch(() => current.disconnect());
};

export let correlationCacheKey = (correlationKey: string) => `gs:corr:${correlationKey}`;

export let inferCacheKey = (inferKey: string) => `gs:infer:${inferKey}`;

export let summaryLockKey = (sessionKey: string) => `gs:session:summary:${sessionKey}`;

// Redis only caches and coordinates here: everything it holds can be rebuilt from Mongo, so a
// failing Redis falls back to the Mongo lookups instead of failing ingest.
export let tryRedis = async <T>(
  operation: (redis: Redis) => Promise<T>
): Promise<T | null> => {
  try {
    return await operation(getSessionRedis());
  } catch (error) {
    console.warn('[groundstation] session cache unavailable', error);
    return null;
  }
};
