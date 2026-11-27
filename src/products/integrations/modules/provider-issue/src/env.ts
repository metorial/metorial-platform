import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});
