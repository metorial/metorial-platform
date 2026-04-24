import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    PACKAGE_BUCKET_NAME: v.string()
  },

  npm: {
    NPM_ORG: v.optional(v.string()),
    NPM_REGISTRY_URL: v.optional(v.string()),
    NPM_TOKEN: v.optional(v.string())
  },

  access: {
    PUBLIC_ACCESS_PERMITTED: v.optional(v.boolean())
  },

  url: {
    SERVICE_PUBLIC_URL: v.string(),
    SUB_REGISTRY_BASE_DOMAIN: v.optional(v.string())
  },

  ares: {
    ARES_AUTH_URL: v.optional(v.string()),
    ARES_CLIENT_ID: v.optional(v.string())
  }
});
