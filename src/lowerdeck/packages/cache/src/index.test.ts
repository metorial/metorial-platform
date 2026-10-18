import { describe, expect, it, vi } from 'vitest';
import { createCachedFunction, createLocallyCachedFunction } from './index';

let { redisStore } = vi.hoisted(() => ({ redisStore: new Map<string, string>() }));

vi.mock('@lowerdeck/redis', () => ({
  createRedisClient: () => ({
    lazy: () => async () => ({
      get: async (key: string) => redisStore.get(key) ?? null,
      set: async (key: string, value: string) => void redisStore.set(key, value),
      del: async (key: string) => void redisStore.delete(key),
      sAdd: async () => {},
      sRem: async () => {},
      sMembers: async () => [],
      expire: async () => {}
    })
  })
}));

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
