import { afterAll, describe, test } from 'bun:test';
import { createRedisLimitStore } from '../../src/lib/redisStore';
import { storeContract } from '../storeContract';

let redis = new Bun.RedisClient(
  process.env.AI_GATEWAY_TEST_REDIS_URL ?? 'redis://localhost:6379'
);
let store = createRedisLimitStore(redis);
let namespaces: string[] = [];

afterAll(async () => {
  for (let ns of namespaces) {
    let keys = (await redis.send('KEYS', [`*${ns}*`])) as string[];
    if (keys.length) await Promise.all(keys.map(key => redis.send('DEL', [key])));
  }

  redis.close();
});

describe('redis limit store contract', () => {
  for (let testCase of storeContract) {
    test(testCase.name, async () => {
      let ns = `aigw-test:${crypto.randomUUID()}`;
      namespaces.push(ns);

      await testCase.run(store, ns);
    });
  }
});
