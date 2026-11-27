import { createError, ServiceError } from '@lowerdeck/error';
import { parseRedisUrl } from '@metorial-subspace/redis-url';
import Redis from 'ioredis';
import { env } from '../env';

let rateLimitExceededError = createError({
  status: 429,
  code: 'rate_limit_exceeded',
  message: 'Too many requests. Please wait a few minutes before trying again.'
});

let redis: Redis | undefined;
let getRedis = () => {
  if (!redis) {
    redis = new Redis(parseRedisUrl(env.service.REDIS_URL));
  }
  return redis;
};

export let consumePublicMcpRateLimit = async (d: {
  key: string;
  limit: { max: number; windowSeconds: number };
}) => {
  let bucket = Math.floor(Date.now() / 1000 / d.limit.windowSeconds);
  let key = `sub:pmcp:rl:${d.key}:${bucket}`;

  try {
    let client = getRedis();
    let count = await client.incr(key);
    if (count === 1) await client.expire(key, d.limit.windowSeconds);

    return count <= d.limit.max;
  } catch (err) {
    // Rate limiting must never take the public endpoints down with Redis.
    console.error('[public-mcp] rate limit check failed', err);
    return true;
  }
};

export let assertPublicMcpRateLimit = async (d: {
  key: string;
  limit: { max: number; windowSeconds: number };
}) => {
  if (await consumePublicMcpRateLimit(d)) return;

  throw new ServiceError(
    rateLimitExceededError({
      oauth: { error: 'slow_down', errorMessage: 'Too many requests' }
    })
  );
};
