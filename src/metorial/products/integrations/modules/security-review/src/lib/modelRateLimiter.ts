import { parseRedisUrl } from '@lowerdeck/redis';
import type { ReviewRateLimiter } from '@metorial/review-engine';
import { Redis } from 'ioredis';
import { env } from '../env';

// Atomically hands out evenly spaced request slots. Returns the wait in milliseconds, or -1
// without reserving anything when the wait would exceed the caller's limit.
let RESERVE_SLOT_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local interval = tonumber(ARGV[1])
local maxWait = tonumber(ARGV[2])

local nextSlot = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, nextSlot)
local wait = slot - now

if wait > maxWait then return -1 end

redis.call('SET', KEYS[1], tostring(slot + interval), 'PX', math.ceil(wait + interval * 2 + 60000))
return wait
`;

let redis: Redis | undefined;
let getRedis = () => (redis ??= new Redis(parseRedisUrl(env.service.REDIS_URL)));

export let redisModelRateLimiter: ReviewRateLimiter = {
  reserve: async d => {
    try {
      let wait = Number(
        await getRedis().eval(
          RESERVE_SLOT_SCRIPT,
          1,
          `sub:srev:model-rl:${d.key}`,
          d.intervalMs,
          Number.isFinite(d.maxWaitMs) ? d.maxWaitMs : Number.MAX_SAFE_INTEGER
        )
      );

      return wait < 0 ? null : wait;
    } catch (error) {
      console.error('Security review model rate limiter failed', error);
      return 0;
    }
  }
};
