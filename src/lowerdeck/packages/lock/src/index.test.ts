import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let redisInstances: Array<{ quit: ReturnType<typeof vi.fn> }> = [];
  let acquire = vi.fn();
  let quit = vi.fn(async () => {});

  return { redisInstances, acquire, quit };
});

vi.mock('ioredis', () => ({
  Redis: class {
    setnx = vi.fn();
    expire = vi.fn();
    set = vi.fn();
    get = vi.fn();
    quit = vi.fn(async () => {});

    constructor() {
      mocks.redisInstances.push(this);
    }
  }
}));

vi.mock('redlock', () => ({
  default: class {
    acquire = mocks.acquire;
    quit = mocks.quit;
  }
}));

import { closeLockPool, createLock } from './index';

let createFakeLease = (durationMs: number) => {
  let lease: any = {
    expiration: Date.now() + durationMs,
    extend: vi.fn(async (nextDurationMs: number) => {
      lease.expiration = Date.now() + nextDurationMs;
      return lease;
    }),
    release: vi.fn(async () => {})
  };
  return lease;
};

describe('lock pooling and acquisition', () => {
  beforeEach(async () => {
    await closeLockPool();
    mocks.redisInstances.length = 0;
    mocks.acquire.mockReset();
    mocks.quit.mockClear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await closeLockPool();
  });

  it('shares one Redis client between locks using the same URL', () => {
    for (let i = 0; i < 500; i++) {
      createLock({ name: `lock-${i}`, redisUrl: 'redis://localhost:6379/0' });
    }

    expect(mocks.redisInstances).toHaveLength(1);
  });

  it('keeps the Redis pool across module reloads', async () => {
    for (let i = 0; i < 250; i++) {
      createLock({ name: `before-reload-${i}`, redisUrl: 'redis://localhost:6379/0' });
    }

    vi.resetModules();
    let reloadedLockModule = await vi.importActual<typeof import('./index')>('./index');
    for (let i = 0; i < 250; i++) {
      reloadedLockModule.createLock({
        name: `after-reload-${i}`,
        redisUrl: 'redis://localhost:6379/0'
      });
    }

    expect(mocks.redisInstances).toHaveLength(1);
  });

  it('uses fresh acquisition attempts so waiting does not consume the lease', async () => {
    vi.useFakeTimers();
    mocks.acquire
      .mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))
      .mockRejectedValueOnce(new Error('locked'))
      .mockImplementationOnce(async (_keys, durationMs) => createFakeLease(durationMs));

    let lock = createLock({ name: 'contended', redisUrl: 'redis://localhost:6379/0' });
    let remainingLeaseMs = 0;
    let resultPromise = lock.usingLock(
      'resource',
      async () => {
        let lease = await mocks.acquire.mock.results.at(-1)!.value;
        remainingLeaseMs = lease.expiration - Date.now();
        return 'ok';
      },
      {
        durationMs: 10_000,
        acquisitionTimeoutMs: 5_000,
        retryDelay: 1_000,
        retryJitter: 0
      }
    );

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(resultPromise).resolves.toBe('ok');
    expect(remainingLeaseMs).toBeGreaterThanOrEqual(9_900);
    expect(mocks.acquire).toHaveBeenCalledTimes(4);
    expect(mocks.acquire).toHaveBeenCalledWith(expect.any(Array), 10_000, {
      retryCount: 0
    });
  });

  it('bounds acquisition by acquisitionTimeoutMs', async () => {
    vi.useFakeTimers();
    mocks.acquire.mockRejectedValue(new Error('locked'));

    let lock = createLock({ name: 'bounded', redisUrl: 'redis://localhost:6379/0' });
    let resultPromise = lock.usingLock('resource', async () => 'never', {
      acquisitionTimeoutMs: 2_500,
      retryDelay: 1_000,
      retryJitter: 0
    });

    let assertion = expect(resultPromise).rejects.toThrow('locked');
    await vi.advanceTimersByTimeAsync(2_500);
    await assertion;
    expect(mocks.acquire).toHaveBeenCalledTimes(3);
  });
});
