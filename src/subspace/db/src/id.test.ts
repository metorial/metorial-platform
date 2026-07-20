import { afterEach, describe, expect, it } from 'bun:test';
import {
  createSnowflakeWorkerLease,
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
  await releaseSnowflakeWorkerLease();
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

  it('fails fast in production before the lease is initialized', () => {
    process.env.METORIAL_ENV = 'production';

    expect(() => snowflake.nextId()).toThrow('Snowflake worker lease has not been initialized');
  });
});
