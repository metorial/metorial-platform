import { defineSettings, setting } from '@metorial/settings';
import { emailAddress, emailName, redisUrl, serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),
    SSO_DATABASE_URL: v.string(),
    RELAY_URL: serviceUrl('relay'),

    ARES_AUTH_URL: v.string(),
    TWO_FACTOR_SETUP_ENABLED: v.optional(v.string()),
    WEBAUTHN_RP_ID: v.optional(v.string()),
    ARES_ADMIN_URL: setting(v.string(), { requiredIn: ['cloud'] }),
    ARES_SSO_URL: v.string(),

    ARES_AUTH_PORT: v.optional(v.number()),
    ARES_ADMIN_PORT: v.optional(v.number()),
    ARES_SSO_PORT: v.optional(v.number()),
    ARES_INTERNAL_PORT: v.optional(v.number()),

    SSO_DATABASE_SSL: v.optional(v.string())
  },

  email: {
    EMAIL_NAME: emailName,
    EMAIL_ADDRESS: emailAddress
  },

  turnstile: {
    TURNSTILE_SITE_KEY: v.optional(v.string()),
    TURNSTILE_SECRET_KEY: v.optional(v.string())
  },

  sso: {
    SAML_AUDIENCE: v.string()
  },

  keys: {
    AUTH_TICKET_SECRET: v.string(),
    TWO_FACTOR_ENCRYPTION_KEY: v.optional(v.string())
  }
});
