import { createRedisClient } from '@lowerdeck/redis';
import { getSentry } from '@lowerdeck/sentry';
import { LRUCache } from 'lru-cache';

// @ts-ignore
import SuperJson from 'superjson';

let Sentry = getSentry();

// Local entries are per process, so `clear()` evicts only this process's copy. The short local
// TTL bounds how long other processes keep serving a value that was cleared elsewhere.
let MAX_LOCAL_TTL_SECONDS = 5;

let version = 0;

export let createCachedFunction = <I, O>(opts: {
  name: string;
  redisUrl: string;
  getHash: (i: I) => string;
  provider: (i: I, opts: { setTTL: (ttl: number) => void }) => Promise<O>;
  ttlSeconds: number;
  getTags?: (o: O, i: I) => string[];
  revalidate?: (o: O, i: I) => Promise<boolean>;
}) => {
  let active = new Map<string, Promise<O>>();
  let cache = new LRUCache<string, any>({
    max: 500,
    ttl: Math.min(opts.ttlSeconds, MAX_LOCAL_TTL_SECONDS) * 1000
  });

  let useRedisClient = createRedisClient({ redisUrl: opts.redisUrl }).lazy();

  let getHash = (i: I) => `cache:${version}:${opts.name}:val:${opts.getHash(i)}`;
  let getTagKeys = (tags: string[]) => tags.map(tag => `cache:${version}:tag:${tag}`);

  let removeFromTags = async (hash: string, value: O, i: I) => {
    if (!opts.getTags) return;

    let redis = await useRedisClient();
    let tagKeys = getTagKeys(opts.getTags(value, i));

    for (let tagKey of tagKeys) {
      try {
        await redis.sRem(tagKey, hash);
      } catch (e) {
        console.error('Error removing tag:', e);
        Sentry.captureException(e);
      }
    }
  };

  let run = async (i: I): Promise<O> => {
    let hash = getHash(i);
    if (active.has(hash)) return await active.get(hash)!;
    if (cache.has(hash) && !opts.revalidate) return cache.get(hash)!;

    let promise = (async () => {
      let redis = await useRedisClient();

      // The local copy can lag redis, so failing it only drops this process's copy: redis may
      // already hold a value another process recomputed, and that one gets checked on its own.
      if (cache.has(hash)) {
        let local: O = cache.get(hash);
        if (await opts.revalidate!(local, i)) return local;

        cache.delete(hash);
      }

      let stored = await redis.get(hash);
      if (stored) {
        let parsed: O = SuperJson.parse(stored);

        if (!opts.revalidate || (await opts.revalidate(parsed, i))) {
          cache.set(hash, parsed);
          return parsed;
        }

        await redis.del(hash);
        await removeFromTags(hash, parsed, i);
      }

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
    let clearActive = () => {
      active.delete(hash);
    };
    void promise.then(clearActive, clearActive);

    return await promise;
  };

  let clearAndWait = async (i: I) => {
    let hash = getHash(i);
    cache.delete(hash);

    let redis = await useRedisClient();

    let data = await redis.get(hash);
    if (!data) return;

    await redis.del(hash);
    await removeFromTags(hash, SuperJson.parse(data), i);
  };

  let clearByTagAndWait = async (tag: string) => {
    let redis = await useRedisClient();
    let tagKey = getTagKeys([tag])[0]!;

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
  revalidate?: (o: O, i: I) => Promise<boolean>;
}) => {
  let cache = new LRUCache<string, any>({ max: 500, ttl: opts.ttlSeconds * 1000 });

  let active = new Map<string, Promise<O>>();

  let getHash = (i: I) => opts.getHash(i);

  let run = async (i: I): Promise<O> => {
    let hash = getHash(i);
    if (active.has(hash)) return await active.get(hash)!;
    if (cache.has(hash) && !opts.revalidate) return cache.get(hash)!;

    let promise = (async () => {
      if (cache.has(hash)) {
        let cached: O = cache.get(hash);
        if (await opts.revalidate!(cached, i)) return cached;

        cache.delete(hash);
      }

      let result = await opts.provider(i);
      cache.set(hash, result);
      return result;
    })();

    active.set(hash, promise);
    let clearActive = () => {
      active.delete(hash);
    };
    void promise.then(clearActive, clearActive);

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
