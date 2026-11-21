import { describe, expect, it } from 'vitest';
import { createContextCache, type ContextVersionKey } from '../src/lib/contextCache';

let createRedis = () => {
  let values = new Map<string, string>();
  let up = true;

  let versionKey = (organizationId: string): ContextVersionKey => ({
    read: async () => (up ? { version: values.get(organizationId) ?? null } : null),
    publish: async version => {
      if (up) values.set(organizationId, version);
    }
  });

  return {
    versionKey,
    setUp: (value: boolean) => (up = value)
  };
};

let setup = () => {
  let redis = createRedis();
  let clock = { now: 0 };
  let loads: string[] = [];

  let cache = (ttlMs = 30_000) =>
    createContextCache({
      ttlMs,
      now: () => clock.now,
      versionKey: redis.versionKey,
      load: async organizationId => {
        loads.push(organizationId);
        return { organizationId, load: loads.length };
      }
    });

  return { redis, clock, loads, cache };
};

describe('createContextCache', () => {
  it('serves the cached context while the published version is unchanged', async () => {
    let { cache, loads } = setup();
    let contexts = cache();

    await contexts.get('org_a');
    await contexts.get('org_a');

    expect(loads).toEqual(['org_a']);
  });

  it('reloads in another process once a change publishes a new version', async () => {
    let { cache, loads } = setup();
    let worker = cache();
    let api = cache();

    expect(await worker.get('org_a')).toMatchObject({ load: 1 });

    await api.invalidate('org_a');

    expect(await worker.get('org_a')).toMatchObject({ load: 2 });
    expect(await worker.get('org_a')).toMatchObject({ load: 2 });
    expect(await worker.get('org_b')).toMatchObject({ load: 3 });
    expect(loads).toEqual(['org_a', 'org_a', 'org_b']);
  });

  it('keeps reloading for every later change, not only the first', async () => {
    let { cache } = setup();
    let worker = cache();
    let api = cache();

    await worker.get('org_a');

    await api.invalidate('org_a');
    expect(await worker.get('org_a')).toMatchObject({ load: 2 });

    await api.invalidate('org_a');
    expect(await worker.get('org_a')).toMatchObject({ load: 3 });
  });

  it('falls back to the TTL when Redis is unavailable', async () => {
    let { cache, clock, redis, loads } = setup();
    let worker = cache(1000);
    let api = cache(1000);

    await worker.get('org_a');

    redis.setUp(false);
    await api.invalidate('org_a');

    await worker.get('org_a');
    expect(loads).toHaveLength(1);

    clock.now = 1000;
    await worker.get('org_a');
    expect(loads).toHaveLength(2);
  });

  it('drops the local copy on invalidate even when Redis is unavailable', async () => {
    let { cache, redis, loads } = setup();
    let contexts = cache();

    await contexts.get('org_a');

    redis.setUp(false);
    await contexts.invalidate('org_a');
    await contexts.get('org_a');

    expect(loads).toHaveLength(2);
  });

  it('does not keep a failed load', async () => {
    let redis = createRedis();
    let attempts = 0;

    let contexts = createContextCache({
      ttlMs: 30_000,
      versionKey: redis.versionKey,
      load: async () => {
        attempts++;
        if (attempts == 1) throw new Error('database unavailable');
        return { attempts };
      }
    });

    await expect(contexts.get('org_a')).rejects.toThrow('database unavailable');
    expect(await contexts.get('org_a')).toEqual({ attempts: 2 });
  });
});
