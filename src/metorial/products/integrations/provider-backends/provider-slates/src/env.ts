import { v } from '@lowerdeck/validation';
import { defineSettings } from '@metorial/settings';
import { redisUrl, serviceUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,

    SLATES_HUB_URL: serviceUrl('slatesHub'),
    SLATES_HUB_PUBLIC_URL: v.string(),

    REGISTRY_URL: v.optional(v.string())
  }
});
