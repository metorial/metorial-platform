import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    SSO_DATABASE_URL: v.string(),
    ARES_AUTH_URL: v.string(),
    ARES_SSO_URL: v.string(),
    SSO_DATABASE_SSL: v.optional(v.string())
  },

  sso: {
    SAML_AUDIENCE: v.string()
  }
});
