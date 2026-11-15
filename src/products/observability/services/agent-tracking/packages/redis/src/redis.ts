import { Redis } from 'ioredis';
import { env } from './env';

let cacheCommandTimeoutMs = 1000;

let clients: { cache?: Redis; coordination?: Redis } = {};

export let redisKey = (...parts: string[]) => ['gs', ...parts].join(':');

// Fails fast: everything it holds can be rebuilt from the stores, so callers fall back instead
// of waiting on Redis.
export let getCacheRedis = () =>
  (clients.cache ??= new Redis(env.service.REDIS_URL, {
    lazyConnect: true,
    commandTimeout: cacheCommandTimeoutMs,
    maxRetriesPerRequest: 1
  }));

export let getCoordinationRedis = () =>
  (clients.coordination ??= new Redis(env.service.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true
  }));

export let closeRedis = async () => {
  let current = Object.values(clients);
  clients = {};

  await Promise.all(current.map(client => client.quit().catch(() => client.disconnect())));
};

export let tryRedis = async <T>(
  operation: (redis: Redis) => Promise<T>
): Promise<T | null> => {
  try {
    return await operation(getCacheRedis());
  } catch (error) {
    console.warn('[agent-tracking] redis unavailable', error);
    return null;
  }
};

// A counter other processes compare against their cached copy, so a write in one process drops
// the caches of all others.
export let createVersionKey = (key: string) => ({
  key,
  publish: (version: string) => tryRedis(redis => redis.set(key, version)),
  read: () => tryRedis(async redis => ({ version: await redis.get(key) }))
});
