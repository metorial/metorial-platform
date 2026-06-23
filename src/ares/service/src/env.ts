import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),
    SSO_DATABASE_URL: v.string(),
    RELAY_URL: v.string(),

    ARES_AUTH_URL: v.string(),
    ARES_ADMIN_URL: v.string(),
    ARES_SSO_URL: v.string(),

    SSO_DATABASE_SSL: v.optional(v.string())
  },

  email: {
    EMAIL_NAME: v.string(),
    EMAIL_ADDRESS: v.string()
  },

  turnstile: {
    TURNSTILE_SITE_KEY: v.optional(v.string()),
    TURNSTILE_SECRET_KEY: v.optional(v.string())
  },

  sso: {
    SAML_AUDIENCE: v.string()
  },

  keys: {
    AUTH_TICKET_SECRET: v.string()
  }
});
