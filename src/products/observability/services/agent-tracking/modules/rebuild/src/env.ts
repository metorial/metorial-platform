import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

export let env = {
  ...serviceSettings
};
