import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: v.string()
  },

  functionBay: {
    FUNCTION_BAY_API_URL: v.string()
  }
});
