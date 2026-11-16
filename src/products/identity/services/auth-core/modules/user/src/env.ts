import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    ARES_AUTH_URL: v.string(),
    TWO_FACTOR_SETUP_ENABLED: v.optional(v.string()),
    WEBAUTHN_RP_ID: v.optional(v.string())
  },

  keys: {
    TWO_FACTOR_ENCRYPTION_KEY: v.optional(v.string())
  }
});
