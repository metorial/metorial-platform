import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  smtp: {
    EMAIL_HOST: v.optional(v.string()),
    EMAIL_PORT: v.optional(v.number()),
    EMAIL_SECURE: v.optional(v.boolean()),
    EMAIL_USER: v.optional(v.string()),
    EMAIL_PASS: v.optional(v.string()),

    EMAIL_SES_ACCESS_KEY_ID: v.optional(v.string()),
    EMAIL_SES_SECRET_ACCESS_KEY: v.optional(v.string()),
    EMAIL_SES_REGION: v.optional(v.string()),

    EMAIL_FROM: v.string(),
    EMAIL_FROM_NAME: v.string()
  },

  urls: {
    API_URL: v.string(),
    APP_URL: v.string()
  },

  env: {
    METORIAL_ENV: v.enumOf(['development', 'staging', 'production']),
    NODE_ENV: v.enumOf(['development', 'production'])
  }
});
