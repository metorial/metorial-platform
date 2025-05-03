import { createRedisClient } from '@metorial/redis';
import { getSentry } from '@metorial/sentry';
import { LRUCache } from 'lru-cache';
import SuperJson from 'superjson';

let Sentry = getSentry();

let cache = new LRUCache<string, any>({ max: 500, ttl: 15 });

let version = 0;

export let createCachedFunction = <I, O>(opts: {
  name: string;
  getHash: (i: I) => string;
  provider: (i: I, opts: { setTTL: (ttl: number) => void }) => Promise<O>;
  redisUrl: string;
  ttlSeconds: number;
  getTags?: (o: O, i: I) => string[];
}) => {
  let active = new Map<string, Promise<O>>();

  let useRedisClient = createRedisClient({ url: opts.redisUrl }).lazy();

  let getHash = (i: I) => `cache:${version}:${opts.name}:val:${opts.getHash(i)}`;
  let getTagKeys = (tags: string[]) => tags.map(tag => `cache:${version}:tag:${tag}`);

  let run = async (i: I): Promise<O> => {
    let hash = getHash(i);
    if (active.has(hash)) return await active.get(hash)!;
    if (cache.has(hash)) return cache.get(hash)!;

    let promise = (async () => {
      let redis = await useRedisClient();
      let value = await redis.get(hash);
      if (value) return SuperJson.parse(value);

      let ttl = { current: opts.ttlSeconds };
      let setTTL = (newTTL: number) => (ttl.current = newTTL);

      let result = await opts.provider(i, { setTTL });
      await redis.set(hash, SuperJson.stringify(result), {
        EX: ttl.current
      });

      if (opts.getTags) {
        let tags = opts.getTags(result, i);
        let tagKeys = getTagKeys(tags);
        Promise.all(
          tagKeys.map(async tagKey => {
            await redis.sAdd(tagKey, hash);
            await redis.expire(tagKey, ttl.current);
          })
        ).catch(console.error);
      }

      cache.set(hash, result);

      return result as any;
    })();

    active.set(hash, promise);
    promise.finally(() => active.delete(hash));

    return await promise;
  };

  let clearAndWait = async (i: I) => {
    let hash = getHash(i);
    let redis = await useRedisClient();

    let data = await redis.get(hash);
    if (!data) return;

    await redis.del(hash);
    cache.delete(hash);

    if (opts.getTags) {
      let tags = opts.getTags(SuperJson.parse(data), i);
      let tagKeys = getTagKeys(tags);
      for (let tagKey of tagKeys) {
        try {
          await redis.sRem(tagKey, hash);
        } catch (e) {
          console.error('Error removing tag:', e);
          Sentry.captureException(e);
        }
      }
    }
  };

  let clearByTagAndWait = async (tag: string) => {
    let redis = await useRedisClient();
    let tagKey = getTagKeys([tag])[0];

    let hashes = await redis.sMembers(tagKey);

    for (let hash of hashes) {
      await redis.del(hash);
      cache.delete(hash);
    }

    await redis.del(tagKey);
  };

  let clear = async (i: I) => {
    clearAndWait(i).catch(err => {
      console.error(err);
      Sentry.captureException(err);
    });
  };

  let clearByTag = async (tag: string) => {
    clearByTagAndWait(tag).catch(err => {
      console.error(err);
      Sentry.captureException(err);
    });
  };

  return Object.assign(run, { clear, clearByTag, clearAndWait, clearByTagAndWait });
};

export let createLocallyCachedFunction = <I, O>(opts: {
  getHash: (i: I) => string;
  provider: (i: I) => Promise<O>;
  ttlSeconds: number;
}) => {
  let cache = new LRUCache<string, any>({ max: 500, ttl: opts.ttlSeconds });

  let active = new Map<string, Promise<O>>();

  let getHash = (i: I) => opts.getHash(i);

  let run = async (i: I): Promise<O> => {
    let hash = getHash(i);
    if (active.has(hash)) return await active.get(hash)!;
    if (cache.has(hash)) return cache.get(hash)!;

    let promise = (async () => {
      let result = await opts.provider(i);
      cache.set(hash, result);
      return result;
    })();

    active.set(hash, promise);
    promise.finally(() => active.delete(hash));

    return await promise;
  };

  let clearAndWait = async (i: I) => {
    let hash = getHash(i);
    cache.delete(hash);
  };

  let clear = async (i: I) => {
    clearAndWait(i).catch(err => {
      console.error(err);
      Sentry.captureException(err);
    });
  };

  return Object.assign(run, { clear, clearAndWait });
};
