import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    ARES_AUTH_URL: v.string()
  },

  turnstile: {
    TURNSTILE_SITE_KEY: v.optional(v.string())
  }
});
