import { delay } from '@lowerdeck/delay';
import { parseRedisUrl } from '@lowerdeck/redis';
import crypto from 'crypto';
import { Redis } from 'ioredis';

// @ts-ignore
import SuperJSON from 'superjson';

// @ts-ignore
import Redlock_ from 'redlock';

interface LockPoolEntry {
  redis: Redis;
  redlock: any;
}

interface LockPoolState {
  entries: Map<string, LockPoolEntry>;
}

let LOCK_POOL_SYMBOL = Symbol.for('@lowerdeck/lock/pool/v1');
let globalWithLockPool = globalThis as typeof globalThis & {
  [LOCK_POOL_SYMBOL]?: LockPoolState;
};

let getLockPool = () => {
  if (!globalWithLockPool[LOCK_POOL_SYMBOL]) {
    globalWithLockPool[LOCK_POOL_SYMBOL] = { entries: new Map() };
  }

  return globalWithLockPool[LOCK_POOL_SYMBOL];
};

let getLockPoolEntry = (redisUrl: string): LockPoolEntry => {
  let pool = getLockPool();
  let existing = pool.entries.get(redisUrl);
  if (existing) return existing;

  let redis = new Redis(parseRedisUrl(redisUrl));
  let redlock = new Redlock_([redis as any], {
    driftFactor: 0.01,
    retryCount: 0,
    retryDelay: 200,
    retryJitter: 200,
    automaticExtensionThreshold: 500
  } as any);

  let entry = { redis, redlock };
  pool.entries.set(redisUrl, entry);
  return entry;
};

export let closeLockPool = async () => {
  let pool = getLockPool();
  let entries = Array.from(pool.entries.values());
  pool.entries.clear();

  await Promise.allSettled(entries.map(entry => entry.redlock.quit()));
};

export let createLock = ({ name, redisUrl }: { name: string; redisUrl: string }) => {
  let hash = crypto.createHash('sha256').update(name).digest();
  let nameHash = hash.readBigUInt64LE(0).toString(36);
  let { redis, redlock } = getLockPoolEntry(redisUrl);

  let usingLock = async <T>(
    key: string | string[],
    fn: (controller: { passForNow: () => void }) => Promise<T>,
    options?: {
      durationMs?: number;
      acquisitionTimeoutMs?: number;
      retryCount?: number;
      retryDelay?: number;
      retryJitter?: number;
    }
  ): Promise<T> => {
    let keyArray = (Array.isArray(key) ? key : [key]).map(k => `l:${nameHash}:${k}`);

    let runLock = async (): Promise<T> => {
      let passingForNow = false;
      let passForNow = () => {
        passingForNow = true;
      };

      let durationMs = options?.durationMs ?? 10_000;
      let acquisitionTimeoutMs = options?.acquisitionTimeoutMs ?? 5_000;
      let retryCount = options?.retryCount ?? 50;
      let retryDelay = options?.retryDelay ?? 200;
      let retryJitter = options?.retryJitter ?? 200;
      let startedAt = Date.now();
      let attempt = 0;
      let lock: any;

      if (durationMs <= 600) {
        throw new Error('Lock duration must be greater than 600ms');
      }
      if (acquisitionTimeoutMs < 0) {
        throw new Error('Lock acquisition timeout cannot be negative');
      }

      while (true) {
        try {
          // Each attempt starts a new lease clock. Redlock's internal retry loop
          // starts the clock before waiting and can otherwise return an expired lock.
          lock = await redlock.acquire(keyArray, durationMs, { retryCount: 0 });
          break;
        } catch (error) {
          let elapsedMs = Date.now() - startedAt;
          if (attempt >= retryCount || elapsedMs >= acquisitionTimeoutMs) {
            console.warn(
              `LOCK.acquire.failed name=${name} keyCount=${keyArray.length} attempts=${attempt + 1} elapsedMs=${elapsedMs}`
            );
            throw error;
          }

          let jitter = Math.floor((Math.random() * 2 - 1) * retryJitter);
          let retryInMs = Math.max(0, retryDelay + jitter);
          if (retryInMs >= acquisitionTimeoutMs - elapsedMs) {
            console.warn(
              `LOCK.acquire.failed name=${name} keyCount=${keyArray.length} attempts=${attempt + 1} elapsedMs=${elapsedMs}`
            );
            throw error;
          }

          attempt++;
          await delay(retryInMs);
        }
      }

      let acquiredAfterMs = Date.now() - startedAt;
      if (acquiredAfterMs >= 500) {
        console.warn(
          `LOCK.acquire.slow name=${name} keyCount=${keyArray.length} attempts=${attempt + 1} elapsedMs=${acquiredAfterMs}`
        );
      }

      let extensionTimer: ReturnType<typeof setTimeout> | null = null;
      let extensionPromise: Promise<void> | null = null;
      let extensionStopped = false;

      let queueExtension = () => {
        if (extensionStopped) return;

        let extensionInMs = Math.max(0, lock.expiration - Date.now() - 500);
        extensionTimer = setTimeout(() => {
          extensionTimer = null;
          extensionPromise = (async () => {
            while (!extensionStopped) {
              try {
                lock = await lock.extend(durationMs);
                queueExtension();
                return;
              } catch (error) {
                if (Date.now() < lock.expiration) {
                  await delay(Math.min(50, Math.max(0, lock.expiration - Date.now())));
                  continue;
                }

                console.error(
                  `LOCK.extend.failed name=${name} keyCount=${keyArray.length} heldMs=${Date.now() - startedAt}`,
                  error
                );
                return;
              }
            }
          })();
        }, extensionInMs);
      };

      queueExtension();

      let result: T;
      try {
        result = await fn({ passForNow });
      } finally {
        extensionStopped = true;
        if (extensionTimer) clearTimeout(extensionTimer);
        let pendingExtension = extensionPromise as Promise<void> | null;
        if (pendingExtension) await pendingExtension.catch(() => {});

        try {
          await lock.release();
        } catch (error) {
          console.error(
            `LOCK.release.failed name=${name} keyCount=${keyArray.length} heldMs=${Date.now() - startedAt}`,
            error
          );
          throw error;
        }
      }

      if (passingForNow) {
        await delay(100);
        return await runLock();
      }

      return result;
    };

    return await runLock();
  };

  let doOnce = async <T>(key: string, fn: () => Promise<T>): Promise<T | null> => {
    let id = `${nameHash}:${Math.random()}:${Date.now()}`;
    let uniquenessHashKey = `luniq:${nameHash}:${key}`;

    let keyWasSet = await redis.setnx(uniquenessHashKey, id);
    await redis.expire(uniquenessHashKey, 60 * 5);

    if (keyWasSet) {
      return await usingLock(key, async () => {
        try {
          return await fn();
        } finally {
          await redis.set(`luniq:${id}:done`, '1', 'EX', 10);
          await redis.expire(uniquenessHashKey, 5);
        }
      });
    }

    let winnerId = await redis.get(uniquenessHashKey);
    if (!winnerId) return null;

    // If we lost, we'll wait for the winner to finish.
    for (let i = 0; i < 25; i++) {
      if (i > 0) await delay(25);

      if (await redis.get(`luniq:${winnerId}:done`)) {
        return null;
      }
    }

    return null;
  };

  let doOnceAndReturn = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    let redisKey = `doa:${nameHash}:${key}`;

    let res = await doOnce(key, async () => {
      let res = await fn();

      await redis.set(redisKey, SuperJSON.stringify(res), 'EX', 60);

      return res;
    });

    if (res == null) {
      return SuperJSON.parse((await redis.get(redisKey)) as string);
    }

    return res;
  };

  return {
    usingLock,
    doOnce,
    doOnceAndReturn
  };
};
