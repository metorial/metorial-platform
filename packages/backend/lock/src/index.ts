import { delay } from '@metorial/delay';
import { parseRedisUrl } from '@metorial/redis';
import { Redis } from 'ioredis';
import SuperJSON from 'superjson';

// @ts-ignore
import Redlock_ from 'redlock';

export let lockFactory = (name: string, redisUrl: string) => {
  let nameHash = Bun.hash.cityHash32(name);
  let redis = new Redis(parseRedisUrl(redisUrl));

  let redlock = new Redlock_([redis as any], {
    // The expected clock drift; for more details see:
    // http://redis.io/topics/distlock
    driftFactor: 0.01, // multiplied by lock ttl to determine drift time

    // The max number of times Redlock will attempt to lock a resource
    // before erroring.
    retryCount: 50,

    // the time in ms between attempts
    retryDelay: 200, // time in ms

    // the max time in ms randomly added to retries
    // to improve performance under high contention
    // see https://www.awsarchitectureblog.com/2015/03/backoff.html
    retryJitter: 200, // time in ms

    // The minimum remaining time on a lock before an extension is automatically
    // attempted with the `using` API.
    automaticExtensionThreshold: 500
  } as any);

  let usingLock = async <T>(
    key: string | string[],
    fn: (controller: { passForNow: () => void }) => Promise<T>
  ): Promise<T> => {
    let keyArray = (Array.isArray(key) ? key : [key]).map(k => `l:${nameHash}:${k}`);

    let runLock = async () => {
      let passingForNow = false;
      let passForNow = () => {
        passingForNow = true;
      };

      let result = await redlock.using(keyArray, 10_000, () => fn({ passForNow }));

      if (passingForNow) {
        await delay(100);
        return runLock();
      }

      return result;
    };

    return runLock();
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
