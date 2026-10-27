import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    SECURITY_REVIEW_BUCKET_NAME: v.string()
  },

  origin: {
    ORIGIN_URL: v.string()
  },

  models: {
    CLOUDFLARE_AI_API_TOKEN: v.optional(v.string()),
    CLOUDFLARE_ACCOUNT_ID: v.optional(v.string()),
    AI_GATEWAY_API_KEY: v.optional(v.string())
  },

  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
