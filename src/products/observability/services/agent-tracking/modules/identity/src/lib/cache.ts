import type { Redis } from 'ioredis';
import { getCoordinationRedis, redisKey } from '@mtsrc/agent-tracking-redis';

let localTtlMs = 60 * 1000;
let localCapacity = 20_000;
let sharedTtlSeconds = 60 * 60;

export type EntityCacheKey = {
  organizationId: string;
  kind: string;
  type: string;
  value: string;
};

export let entityCacheKey = (key: EntityCacheKey) =>
  redisKey('ent', key.organizationId, key.kind, key.type, key.value);

export let createLocalCache = <T>(opts: { ttlMs: number; capacity: number }) => {
  let entries = new Map<string, { value: T; expiresAt: number }>();

  return {
    get: (key: string): T | undefined => {
      let entry = entries.get(key);
      if (!entry) return undefined;

      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return undefined;
      }

      entries.delete(key);
      entries.set(key, entry);

      return entry.value;
    },

    set: (key: string, value: T) => {
      entries.delete(key);
      entries.set(key, { value, expiresAt: Date.now() + opts.ttlMs });

      while (entries.size > opts.capacity) {
        let oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },

    delete: (key: string) => {
      entries.delete(key);
    },

    clear: () => entries.clear()
  };
};

let local = createLocalCache<string>({ ttlMs: localTtlMs, capacity: localCapacity });

// Identifier → entity id. A miss in both tiers falls through to Postgres. The entity service
// invalidates identifiers that move or disappear; other processes only drop their in-process
// copy when it expires.
export let createEntityCache = (redis: Redis) => {
  return {
    getMany: async (keys: EntityCacheKey[]) => {
      let found = new Map<string, string>();
      let missing: string[] = [];

      for (let key of keys) {
        let cacheKey = entityCacheKey(key);
        let value = local.get(cacheKey);

        if (value) found.set(cacheKey, value);
        else missing.push(cacheKey);
      }

      if (missing.length) {
        let values = await redis.mget(...missing);

        missing.forEach((cacheKey, index) => {
          let value = values[index];
          if (!value) return;

          local.set(cacheKey, value);
          found.set(cacheKey, value);
        });
      }

      return found;
    },

    setMany: async (entries: { key: EntityCacheKey; entityId: string }[]) => {
      if (!entries.length) return;

      let pipeline = redis.pipeline();

      for (let entry of entries) {
        let cacheKey = entityCacheKey(entry.key);

        local.set(cacheKey, entry.entityId);
        pipeline.set(cacheKey, entry.entityId, 'EX', sharedTtlSeconds);
      }

      await pipeline.exec();
    },

    deleteMany: async (keys: EntityCacheKey[]) => {
      if (!keys.length) return;

      let cacheKeys = keys.map(entityCacheKey);
      for (let cacheKey of cacheKeys) local.delete(cacheKey);

      await redis.del(...cacheKeys);
    },

    clearLocal: () => local.clear()
  };
};

export type EntityCache = ReturnType<typeof createEntityCache>;

export let invalidateEntityCache = async (d: {
  organizationId: string;
  identifiers: { kind: string; type: string; value: string }[];
}) =>
  await createEntityCache(getCoordinationRedis()).deleteMany(
    d.identifiers.map(identifier => ({ organizationId: d.organizationId, ...identifier }))
  );
