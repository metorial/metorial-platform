import type { BucketUpdate, LimitStore } from './store';

export type RedisCommander = {
  send: (command: string, args: string[]) => Promise<unknown>;
};

let incrementScript = `
local value = redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('PEXPIREAT', KEYS[1], ARGV[2])
return value
`;

// KEYS: bucket hash, index. ARGV: expiresAt, score, pruneBefore, then (op, field, value) triples.
let updateBucketScript = `
for i = 4, #ARGV, 3 do
  local op, field, value = ARGV[i], ARGV[i + 1], ARGV[i + 2]
  if op == 'increment' then
    redis.call('HINCRBY', KEYS[1], field, value)
  elseif op == 'setIfAbsent' then
    redis.call('HSETNX', KEYS[1], field, value)
  else
    redis.call('HSET', KEYS[1], field, value)
  end
end
redis.call('PEXPIREAT', KEYS[1], ARGV[1])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[3])
redis.call('PEXPIREAT', KEYS[2], ARGV[1])
return 1
`;

let toNumber = (value: unknown) => {
  let parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

let hashEntries = (value: unknown): [string, unknown][] => {
  if (Array.isArray(value)) {
    let entries: [string, unknown][] = [];
    for (let i = 0; i + 1 < value.length; i += 2)
      entries.push([String(value[i]), value[i + 1]]);
    return entries;
  }

  if (value && typeof value == 'object') return Object.entries(value);
  return [];
};

let updateArgs = (updates: BucketUpdate[]) =>
  updates.flatMap(update => [update.op, update.field, String(Math.round(update.value))]);

export let createRedisLimitStore = (redis: RedisCommander): LimitStore => ({
  read: async keys =>
    Promise.all(keys.map(async key => toNumber(await redis.send('GET', [key])))),

  increment: async increments =>
    Promise.all(
      increments.map(async increment =>
        toNumber(
          await redis.send('EVAL', [
            incrementScript,
            '1',
            increment.key,
            String(Math.round(increment.by)),
            String(Math.round(increment.expiresAt))
          ])
        )
      )
    ),

  updateBucket: async d => {
    await redis.send('EVAL', [
      updateBucketScript,
      '2',
      d.key,
      d.index,
      String(Math.round(d.expiresAt)),
      String(d.score),
      String(d.pruneBefore),
      ...updateArgs(d.updates)
    ]);
  },

  listBuckets: async d => {
    let members = (await redis.send('ZRANGEBYSCORE', [
      d.index,
      '-inf',
      `(${d.before}`
    ])) as unknown[];

    return members.map(toNumber).sort((a, b) => a - b);
  },

  readBucket: async key =>
    Object.fromEntries(
      hashEntries(await redis.send('HGETALL', [key])).map(([field, value]) => [
        field,
        toNumber(value)
      ])
    ),

  deleteBuckets: async d => {
    if (!d.buckets.length) return;

    await Promise.all(d.buckets.map(bucket => redis.send('DEL', [bucket.key])));
    await redis.send('ZREM', [d.index, ...d.buckets.map(bucket => String(bucket.score))]);
  }
});
