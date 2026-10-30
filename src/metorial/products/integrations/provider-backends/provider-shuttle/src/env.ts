import { defineSettings } from '@metorial/settings';
import { redisUrl, serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,

    SHUTTLE_URL: serviceUrl('shuttle'),
    SHUTTLE_LIVE_URL: v.string(),
    SHUTTLE_PUBLIC_URL: v.string(),

    REGISTRY_URL: v.optional(v.string())
  }
});
