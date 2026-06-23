import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  email: {
    EMAIL_HOST: v.optional(v.string()),
    EMAIL_PORT: v.optional(v.number()),
    EMAIL_SECURE: v.optional(v.boolean()),
    EMAIL_USER: v.optional(v.string()),
    EMAIL_PASSWORD: v.optional(v.string()),

    EMAIL_SES_ACCESS_KEY_ID: v.optional(v.string()),
    EMAIL_SES_SECRET_ACCESS_KEY: v.optional(v.string()),
    EMAIL_SES_REGION: v.optional(v.string())
  }
});
