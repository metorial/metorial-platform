import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    AI_GATEWAY_API_PORT: v.number(),
    AI_GATEWAY_INFERENCE_PORT: v.number(),
    AI_GATEWAY_HEALTH_PORT: v.number(),
    DATABASE_URL: v.string(),
    REDIS_URL: redisUrl,
    AI_GATEWAY_UPSTREAM_PROXY_URL: v.optional(v.string())
  }
});
