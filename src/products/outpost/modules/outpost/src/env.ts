import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  secrets: {
    OUTPOST_KEY_ENCRYPTION_SECRET: v.string()
  },

  urls: {
    OUTPOST_REGIONAL_API_URL: v.optional(v.string())
  }
});
