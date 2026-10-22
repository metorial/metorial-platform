import { getSentry } from '@lowerdeck/sentry';
import { randomBytes } from 'node:crypto';
import { encodeUsageBucketKey, floorToMinute } from './bucket';
import type { UsageEvent } from './types';

let BUCKET_TTL_SECONDS = 6 * 60 * 60;
let CLAIMED_TTL_SECONDS = 7 * 24 * 60 * 60;

// The shared hash tag keeps every usage key in one cluster slot so the Lua scripts can
// touch several keys at once.
let KEY_PREFIX = '{usage}';
let MINUTES_KEY = `${KEY_PREFIX}:minutes`;
let CLAIMED_KEY = `${KEY_PREFIX}:claimed`;

let Sentry = getSentry();

let recordScript = `
local field = ARGV[1]
local minute = ARGV[2]
local count = tonumber(ARGV[3])
local errors = tonumber(ARGV[4])
local duration = tonumber(ARGV[5])

redis.call('HINCRBY', KEYS[1], field .. '|c', count)
if errors > 0 then
  redis.call('HINCRBY', KEYS[1], field .. '|e', errors)
end

if duration >= 0 then
  redis.call('HINCRBY', KEYS[1], field .. '|d', duration)
  redis.call('HINCRBY', KEYS[1], field .. '|n', 1)

  local currentMax = tonumber(redis.call('HGET', KEYS[1], field .. '|x') or '-1')
  if duration > currentMax then
    redis.call('HSET', KEYS[1], field .. '|x', duration)
  end
end

redis.call('EXPIRE', KEYS[1], tonumber(ARGV[6]))
redis.call('ZADD', KEYS[2], minute, minute)

return 1
`;

let claimScript = `
redis.call('ZREM', KEYS[3], ARGV[1])

if redis.call('EXISTS', KEYS[1]) == 0 then
  return 0
end

redis.call('RENAME', KEYS[1], KEYS[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
redis.call('SADD', KEYS[4], KEYS[2])

return 1
`;

let redis: (() => Promise<any>) | undefined;

let getRedis = async () => {
  if (!redis) {
    let { createRedisClient } = await import('@metorial/redis');
    redis = createRedisClient({}).lazy();
  }

  return await redis();
};

let getMinuteKey = (minute: number) => `${KEY_PREFIX}:m:${minute}`;

export let getClaimedUsageBucketKey = (minute: number, nonce: string) =>
  `${KEY_PREFIX}:claimed:${minute}:${nonce}`;

export let parseClaimedUsageBucketKey = (key: string) => {
  let [minute, nonce] = key.slice(`${KEY_PREFIX}:claimed:`.length).split(':');
  return { minute: Number(minute), nonce: nonce! };
};

export let bufferUsageEvent = async (event: UsageEvent) => {
  let minute = floorToMinute(event.ts ?? new Date());
  let duration =
    event.durationMs === undefined || event.durationMs === null || event.durationMs < 0
      ? -1
      : Math.round(event.durationMs);

  try {
    let client = await getRedis();

    await client.eval(recordScript, {
      keys: [getMinuteKey(minute), MINUTES_KEY],
      arguments: [
        encodeUsageBucketKey(event),
        String(minute),
        '1',
        event.isError ? '1' : '0',
        String(duration),
        String(BUCKET_TTL_SECONDS)
      ]
    });
  } catch (e) {
    Sentry.captureException(e);
    console.error('Could not buffer usage event:', e);
  }
};

export let listPendingUsageMinutes = async (d: { before: number; limit: number }) => {
  let client = await getRedis();
  let minutes: string[] = await client.zRangeByScore(MINUTES_KEY, 0, d.before - 1, {
    LIMIT: { offset: 0, count: d.limit }
  });

  return minutes.map(Number);
};

export let claimUsageMinute = async (minute: number) => {
  let client = await getRedis();
  let claimedKey = getClaimedUsageBucketKey(minute, randomBytes(8).toString('hex'));

  let claimed = await client.eval(claimScript, {
    keys: [getMinuteKey(minute), claimedKey, MINUTES_KEY, CLAIMED_KEY],
    arguments: [String(minute), String(CLAIMED_TTL_SECONDS)]
  });

  return Number(claimed) == 1 ? claimedKey : null;
};

export let listClaimedUsageBuckets = async (limit: number) => {
  let client = await getRedis();
  let keys: string[] = await client.sRandMemberCount(CLAIMED_KEY, limit);
  return keys ?? [];
};

export let readClaimedUsageBucket = async (claimedKey: string) => {
  let client = await getRedis();
  return (await client.hGetAll(claimedKey)) as Record<string, string>;
};

export let acknowledgeClaimedUsageBucket = async (claimedKey: string) => {
  let client = await getRedis();

  await client.del(claimedKey);
  await client.sRem(CLAIMED_KEY, claimedKey);
};
