import { getConfig } from '@metorial/config';
import { parseRedisUrl } from '@metorial/redis';
import {
  acquireReviewModel,
  createRedisRateLimiter,
  type ReviewModel,
  type ReviewModelAccess
} from '@metorial/review-engine';
import type { LanguageModel } from 'ai';
import { Redis } from 'ioredis';

// Interactive runs would rather switch to the fallback model than sit in a queue for a slot.
let MODEL_RATE_LIMIT_MAX_WAIT_MS = 10 * 1000;

let redis: Redis | undefined;
let getRedis = () => (redis ??= new Redis(parseRedisUrl(getConfig().redisUrl)));

export let assistantModelAccess: ReviewModelAccess = {
  limiter: createRedisRateLimiter({
    keyPrefix: 'product-assistant:model-rl:',
    runScript: d => getRedis().eval(d.script, 1, d.key, ...d.args),
    onError: error => console.error('Product assistant model rate limiter failed', error)
  }),
  maxWaitMs: MODEL_RATE_LIMIT_MAX_WAIT_MS
};

export let createStepModelSelector =
  (d: { model: ReviewModel; agentName: string }) =>
  async (signal?: AbortSignal): Promise<LanguageModel> =>
    (
      await acquireReviewModel({
        model: d.model,
        access: assistantModelAccess,
        signal,
        onFallback: ({ from, to }) =>
          console.warn(
            `${d.agentName}: ${from.slug} rate limit wait timed out, using ${to.slug}`
          )
      })
    ).model;
