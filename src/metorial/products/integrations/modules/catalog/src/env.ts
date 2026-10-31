import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    REGISTRY_URL: v.optional(v.string())
  }
});
