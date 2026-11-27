import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,

    INTEGRATIONS_API_URL: v.string(),
    INTEGRATIONS_UI_URL: v.string()
  }
});
