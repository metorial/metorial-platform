import { Service } from '@lowerdeck/service';
import type { InferenceLimiter } from '@mtsrc/ai-gateway-module-inference';
import { env } from '../env';
import { createLimitEventRecorder, type LimitEventRecorder } from '../lib/events';
import { createGatewayLimiter } from '../lib/limiter';
import { createRedisLimitStore } from '../lib/redisStore';
import type { LimitStore } from '../lib/store';

let createRedisClient = () => {
  let url = env.service.REDIS_URL;

  return new Bun.RedisClient(url?.replace('rediss://', 'redis://'), {
    tls: url?.startsWith('rediss://')
  });
};

class LimitsServiceImpl implements InferenceLimiter {
  private store: LimitStore | undefined;
  private events: LimitEventRecorder | undefined;
  private limiter: InferenceLimiter | undefined;

  acquire: InferenceLimiter['acquire'] = async d => await this.gatewayLimiter().acquire(d);

  settle: InferenceLimiter['settle'] = async d => await this.gatewayLimiter().settle(d);

  async drainPlatformEvents(d: { tripsBefore: number; usageBefore: number }) {
    return await this.eventRecorder().drain(d);
  }

  async ackPlatformEvents(d: { tripBuckets: number[]; usageHours: number[] }) {
    await this.eventRecorder().ack(d);
  }

  private limitStore() {
    return (this.store ??= createRedisLimitStore(createRedisClient()));
  }

  private eventRecorder() {
    return (this.events ??= createLimitEventRecorder({ store: this.limitStore() }));
  }

  private gatewayLimiter() {
    return (this.limiter ??= createGatewayLimiter({
      store: this.limitStore(),
      events: this.eventRecorder()
    }));
  }
}

export let limitsService = Service.create(
  'limitsService',
  () => new LimitsServiceImpl()
).build();
