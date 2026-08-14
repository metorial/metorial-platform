import { afterEach, describe, expect, it } from 'bun:test';
import {
  appendRegionToClientSecret,
  createSnowflakeWorkerLease,
  generateRegionalClientSecret,
  releaseSnowflakeWorkerLease,
  snowflake,
  type RedisLeaseClient
} from './id';

class FakeRedis implements RedisLeaseClient {
  store = new Map<string, string>();

  async set(key: string, value: string, ...args: any[]) {
    let requiresEmptyKey = args.includes('NX');

    if (requiresEmptyKey && this.store.has(key)) return null;

    this.store.set(key, value);
    return 'OK';
  }

  async eval(script: string, _numKeys: number, key: string, ownerId: string) {
    if (this.store.get(key) !== ownerId) return 0;

    if (script.includes('del')) {
      this.store.delete(key);
    }

    return 1;
  }

  async quit() {}

  disconnect() {}

  steal(key: string, ownerId: string) {
    this.store.set(key, ownerId);
  }
}

afterEach(async () => {
  delete process.env.METORIAL_ENV;
  delete process.env.METORIAL_REGION;
  await releaseSnowflakeWorkerLease();
});

describe('regional client secrets', () => {
  it('appends a valid region without changing the secret', () => {
    expect(appendRegionToClientSecret('pas_secret_abc123', 'eu1')).toBe(
      'pas_secret_abc123_eu1'
    );
  });

  it('generates setup session secrets with the configured region', async () => {
    process.env.METORIAL_REGION = 'us1';

    let providerSecret = await generateRegionalClientSecret(
      'providerSetupSession_clientSecret'
    );
    let integrationSecret = await generateRegionalClientSecret(
      'integrationSetupSession_clientSecret'
    );

    expect(providerSecret).toMatch(/^pas_secret_.+_us1$/);
    expect(integrationSecret).toMatch(/^iss_secret_.+_us1$/);
  });

  it('rejects region identifiers that cannot be parsed as a suffix', () => {
    expect(() => appendRegionToClientSecret('pas_secret_abc123', 'bad_region')).toThrow();
  });
});

describe('Snowflake worker leases', () => {
  it('does not give two live processes the same worker ID', async () => {
    let redis = new FakeRedis();

    let first = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 42,
      autoRenew: false
    });
    let second = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-b',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 42,
      autoRenew: false
    });

    expect(first.workerId).toBe(42);
    expect(second.workerId).toBe(43);

    await first.release();
    await second.release();
  });

  it('detects when renewal ownership has been lost', async () => {
    let redis = new FakeRedis();
    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 7,
      autoRenew: false
    });

    redis.steal(lease.key, 'process-b');

    expect(await lease.renew()).toBe(false);

    await lease.release();
    expect(redis.store.get(lease.key)).toBe('process-b');
  });

  it('does not fatal when renew races with release', async () => {
    let redis = new FakeRedis();
    let fatals: Error[] = [];
    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 11,
      ttlMs: 50,
      renewIntervalMs: 10,
      fatal: error => {
        fatals.push(error);
      }
    });

    await lease.release();
    await Bun.sleep(40);

    expect(fatals).toEqual([]);
    expect(await lease.renew()).toBe(true);
  });

  it('does not fatal when redis closes during shutdown renew', async () => {
    let redis = new FakeRedis();
    let fatals: Error[] = [];
    let originalEval = redis.eval.bind(redis);

    redis.eval = async (script: string, numKeys: number, key: string, ownerId: string) => {
      if (script.includes('pexpire')) {
        await Bun.sleep(20);
        throw new Error('Connection is closed.');
      }

      return originalEval(script, numKeys, key, ownerId);
    };

    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 12,
      ttlMs: 50,
      renewIntervalMs: 5,
      fatal: error => {
        fatals.push(error);
      }
    });

    await Bun.sleep(10);
    await lease.release();
    await Bun.sleep(40);

    expect(fatals).toEqual([]);
  });

  it('generates unique IDs from separately leased workers', async () => {
    let redis = new FakeRedis();
    let first = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 0,
      autoRenew: false
    });
    let second = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-b',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 0,
      autoRenew: false
    });
    let ids = new Set<bigint>();

    for (let i = 0; i < 200; i++) {
      ids.add(first.generator.nextId());
      ids.add(second.generator.nextId());
    }

    expect(ids.size).toBe(400);

    await first.release();
    await second.release();
  });

  it('uses a local random worker in production before the lease is initialized', () => {
    process.env.METORIAL_ENV = 'production';

    expect(() => snowflake.nextId()).not.toThrow();
  });

  it('reclaims the same worker ID after its lease disappears', async () => {
    let redis = new FakeRedis();
    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 21,
      ttlMs: 50,
      renewIntervalMs: 5
    });
    let originalGenerator = lease.generator;

    redis.store.delete(lease.key);
    await Bun.sleep(20);

    expect(lease.workerId).toBe(21);
    expect(lease.generator).toBe(originalGenerator);
    expect(redis.store.get(lease.key)).toBe('process-a');

    await lease.release();
  });

  it('claims another worker ID if the previous one was taken', async () => {
    let redis = new FakeRedis();
    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 31,
      ttlMs: 50,
      renewIntervalMs: 5
    });
    let originalGenerator = lease.generator;

    redis.steal(lease.key, 'process-b');
    await Bun.sleep(20);

    expect(lease.workerId).toBe(32);
    expect(lease.generator).not.toBe(originalGenerator);
    expect(redis.store.get(lease.key)).toBe('process-a');

    await lease.release();
  });

  it('keeps the current worker active while Redis is unavailable', async () => {
    let redis = new FakeRedis();
    let lease = await createSnowflakeWorkerLease({
      redis,
      ownerId: 'process-a',
      keyPrefix: 'test:snowflake-worker',
      startWorkerId: 41,
      ttlMs: 50,
      renewIntervalMs: 5
    });
    let originalGenerator = lease.generator;
    let originalEval = redis.eval.bind(redis);
    let failuresRemaining = 2;

    redis.eval = async (...args: Parameters<FakeRedis['eval']>) => {
      if (failuresRemaining-- > 0) throw new Error('Connection is closed.');
      return originalEval(...args);
    };

    await Bun.sleep(12);
    expect(lease.released).toBe(false);
    expect(lease.generator).toBe(originalGenerator);
    expect(() => lease.generator.nextId()).not.toThrow();

    await Bun.sleep(15);
    expect(await lease.renew()).toBe(true);

    await lease.release();
  });
});
