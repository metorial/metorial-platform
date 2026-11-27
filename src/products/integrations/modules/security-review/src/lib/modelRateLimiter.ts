import { parseRedisUrl } from '@lowerdeck/redis';
import { createRedisRateLimiter, type ReviewRateLimiter } from '@metorial/review-engine';
import { Redis } from 'ioredis';
import { env } from '../env';

let redis: Redis | undefined;
let getRedis = () => (redis ??= new Redis(parseRedisUrl(env.service.REDIS_URL)));

export let redisModelRateLimiter: ReviewRateLimiter = createRedisRateLimiter({
  keyPrefix: 'sub:srev:model-rl:',
  runScript: d => getRedis().eval(d.script, 1, d.key, ...d.args),
  onError: error => console.error('Security review model rate limiter failed', error)
});
