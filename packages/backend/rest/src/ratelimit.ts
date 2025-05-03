import { createError } from '@metorial/error';
import { parseRedisUrl } from '@metorial/redis';
import ARL from 'async-ratelimiter';
import Redis from 'ioredis';
import { Context } from './types';

let error = createError({
  status: 429,
  code: 'rate_limit_exceeded',
  message: 'You have exceeded the rate limit for this instance',
  hint: 'Please wait a few minutes before trying again'
});

export class RateLimiter<AuthInfo> {
  #rateLimiter: ARL;

  constructor(
    redisUrl: string,
    private getKey: (i: { auth: AuthInfo; context: Context }) => string,
    private getMax: (i: { auth: AuthInfo; context: Context }) => number
  ) {
    this.#rateLimiter = new ARL({
      db: new Redis(parseRedisUrl(redisUrl)),
      duration: 1000 * 60 * 10 // 10 minutes
    });
  }

  async check({ auth, context }: { auth: AuthInfo; context: Context }) {
    let limit = await this.#rateLimiter.get({
      id: this.getKey({ auth, context }),
      max: this.getMax({ auth, context })
    });

    let headers = {
      // 'Retry-After': secondsToWait.toString(),
      'RateLimit-Limit': limit.total.toString(),
      'RateLimit-Remaining': Math.max(0, limit.remaining - 1).toString(),
      'RateLimit-Reset': limit.reset.toString()
    };

    if (!limit.remaining) {
      return {
        allowed: false as const,
        response: new Response(JSON.stringify(error.toResponse()), {
          status: error.data.status,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }) as any
      };
    }

    return {
      allowed: true as const,
      headers
    };
  }
}
