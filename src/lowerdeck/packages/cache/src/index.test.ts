import { describe, expect, it, vi } from 'vitest';
import { createCachedFunction, createLocallyCachedFunction } from './index';

let { redisStore, redisSets } = vi.hoisted(() => ({
  redisStore: new Map<string, string>(),
  redisSets: new Map<string, Set<string>>()
}));

vi.mock('@lowerdeck/redis', () => ({
  createRedisClient: () => ({
    lazy: () => async () => ({
      get: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, value: string) => void redisStore.set(key, value),
      del: async (key: string) => {
        redisStore.delete(key);
        redisSets.delete(key);
      },
      sAdd: async (key: string, member: string) => {
        if (!redisSets.has(key)) redisSets.set(key, new Set());
        redisSets.get(key)!.add(member);
      },
      sRem: async (key: string, members: string | string[]) => {
        for (let member of [members].flat()) redisSets.get(key)?.delete(member);
      },
      sMembers: async (key: string) => [...(redisSets.get(key) ?? [])],
      expire: async () => {}
    })
  })
}));

let tagMembers = (name: string, tag: string) => [
  ...(redisSets.get(`cache:0:${name}:tag:${tag}`) ?? [])
];

describe('createCachedFunction', () => {
  it('evicts the local copy on clearAndWait even when redis was already cleared', async () => {
    let provider = vi.fn(async (key: string) => `value:${key}:${provider.mock.calls.length}`);
    let cached = createCachedFunction({
      name: 'clear-local',
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      provider,
      ttlSeconds: 60
    });

    expect(await cached('key')).toBe('value:key:1');

    redisStore.clear();
    await cached.clearAndWait('key');

    expect(await cached('key')).toBe('value:key:2');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('revalidates values served from redis but not freshly computed ones', async () => {
    let provider = vi.fn(async (key: string) => `value:${key}:${provider.mock.calls.length}`);
    let revalidate = vi.fn(async () => false);
    let options = {
      name: 'revalidate-redis',
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      provider,
      revalidate,
      ttlSeconds: 60
    };

    expect(await createCachedFunction(options)('key')).toBe('value:key:1');
    expect(revalidate).not.toHaveBeenCalled();

    expect(await createCachedFunction(options)('key')).toBe('value:key:2');
    expect(revalidate).toHaveBeenCalledWith('value:key:1', 'key');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('removes a value that fails revalidation from its old tags', async () => {
    let provider = vi.fn(async () => `owner:${provider.mock.calls.length}`);
    let options = {
      name: 'revalidate-tags',
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      getTags: (value: string) => [value],
      provider,
      revalidate: async (value: string) => value !== 'owner:1',
      ttlSeconds: 60
    };

    await createCachedFunction(options)('key');
    await new Promise(resolve => setTimeout(resolve, 0));

    let refreshed = createCachedFunction(options);
    expect(await refreshed('key')).toBe('owner:2');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(tagMembers('revalidate-tags', 'owner:1')).toEqual([]);
    expect(tagMembers('revalidate-tags', 'owner:2')).toHaveLength(1);

    await refreshed.clearByTagAndWait('owner:1');
    expect(await refreshed('key')).toBe('owner:2');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('clears each cache by tag when several caches share the tag', async () => {
    let createCache = (name: string) => {
      let provider = vi.fn(
        async (key: string) => `${name}:${key}:${provider.mock.calls.length}`
      );
      let cached = createCachedFunction({
        name,
        redisUrl: 'redis://test',
        getHash: (key: string) => key,
        getTags: () => ['shared'],
        provider,
        ttlSeconds: 60
      });

      return { cached, provider };
    };
    let first = createCache('shared-tag-first');
    let second = createCache('shared-tag-second');

    await first.cached('key');
    await second.cached('key');
    await new Promise(resolve => setTimeout(resolve, 0));

    await first.cached.clearByTagAndWait('shared');
    await second.cached.clearByTagAndWait('shared');

    expect(await first.cached('key')).toBe('shared-tag-first:key:2');
    expect(await second.cached('key')).toBe('shared-tag-second:key:2');
  });

  it('keeps tag entries added while a tag is being cleared', async () => {
    let name = 'concurrent-tag-clear';
    let cached = createCachedFunction({
      name,
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      getTags: () => ['tag'],
      provider: async (key: string) => key,
      ttlSeconds: 60
    });

    await cached('first');
    await new Promise(resolve => setTimeout(resolve, 0));

    let tagKey = `cache:0:${name}:tag:tag`;
    let members = redisSets.get(tagKey)!;
    let originalDelete = members.delete.bind(members);
    members.delete = (member: string) => {
      members.add(`cache:0:${name}:val:second`);
      members.delete = originalDelete;
      return originalDelete(member);
    };

    await cached.clearByTagAndWait('tag');

    expect(tagMembers(name, 'tag')).toEqual([`cache:0:${name}:val:second`]);
  });

  it('falls back to redis when the local copy fails revalidation', async () => {
    let provider = vi.fn(async () => `version:${provider.mock.calls.length}`);
    let current = 'version:1';
    let options = {
      name: 'revalidate-stale-local',
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      provider,
      revalidate: async (value: string) => value === current,
      ttlSeconds: 60
    };

    let lagging = createCachedFunction(options);
    await lagging('key');

    current = 'version:2';
    await createCachedFunction(options)('key');

    expect(await lagging('key')).toBe('version:2');
    expect(provider).toHaveBeenCalledTimes(2);
    expect(redisStore.has('cache:0:revalidate-stale-local:val:key')).toBe(true);
  });

  it('serves a local hit that still revalidates', async () => {
    let provider = vi.fn(async (key: string) => `value:${key}`);
    let revalidate = vi.fn(async () => true);
    let cached = createCachedFunction({
      name: 'revalidate-local',
      redisUrl: 'redis://test',
      getHash: (key: string) => key,
      provider,
      revalidate,
      ttlSeconds: 60
    });

    await cached('key');
    expect(await cached('key')).toBe('value:key');

    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledTimes(1);
  });
});

describe('createLocallyCachedFunction', () => {
  it('cleans up rejected requests without creating an unhandled rejection', async () => {
    let expectedError = new Error('Expected provider failure');
    let provider = vi.fn(async () => {
      throw expectedError;
    });
    let cached = createLocallyCachedFunction({
      getHash: (key: string) => key,
      provider,
      ttlSeconds: 60
    });
    let unhandledRejections: unknown[] = [];
    let onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };

    process.on('unhandledRejection', onUnhandledRejection);
    try {
      await expect(cached('key')).rejects.toBe(expectedError);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(unhandledRejections).toEqual([]);

      await expect(cached('key')).rejects.toBe(expectedError);
      expect(provider).toHaveBeenCalledTimes(2);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('revalidates hits only and recomputes values that fail it', async () => {
    let provider = vi.fn(async (key: string) => `value:${key}:${provider.mock.calls.length}`);
    let revalidate = vi.fn(async (value: string) => value.endsWith(':2'));
    let cached = createLocallyCachedFunction({
      getHash: (key: string) => key,
      provider,
      revalidate,
      ttlSeconds: 60
    });

    expect(await cached('key')).toBe('value:key:1');
    expect(revalidate).not.toHaveBeenCalled();

    expect(await cached('key')).toBe('value:key:2');
    expect(await cached('key')).toBe('value:key:2');

    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('keeps values for ttlSeconds, not milliseconds', async () => {
    let provider = vi.fn(async (key: string) => `value:${key}`);
    let cached = createLocallyCachedFunction({
      getHash: (key: string) => key,
      provider,
      ttlSeconds: 1
    });

    await cached('key');
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(await cached('key')).toBe('value:key');
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
