import { defineSettings } from '@metorial/settings';
import { redisUrl, serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl
  },

  functionBay: {
    FUNCTION_BAY_API_URL: serviceUrl('functionBay')
  }
});
