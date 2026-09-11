import { RedisChallengeStore } from '@metorial-outpost/server';
import { createRedisClient } from '@metorial/redis';

let getRedis = createRedisClient({}).lazy();

export let outpostChallengeStore = new RedisChallengeStore({
  client: {
    set: async (key, value, ttlMs) => {
      let redis = await getRedis();
      await redis.set(key, value, { PX: ttlMs });
    },
    setIfNotExists: async (key, value, ttlMs) => {
      let redis = await getRedis();
      return (await redis.set(key, value, { PX: ttlMs, NX: true })) == 'OK';
    },
    get: async key => {
      let redis = await getRedis();
      return await redis.get(key);
    }
  }
});
