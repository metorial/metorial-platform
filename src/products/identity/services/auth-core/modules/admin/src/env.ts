import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    ARES_ADMIN_URL: setting(v.string(), { requiredIn: ['cloud'] })
  }
});
