import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  internal: {
    HUB_SERVICE_CREDENTIAL: v.string(),
    SUBSPACE_SERVICE_CREDENTIAL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    LOGS_BUCKET_NAME: v.string()
  },

  encryption: {
    ENCRYPTION_KEY: v.optional(v.string()),
    ENCRYPTION_KEYRING_JSON: v.optional(v.string()),
    ENCRYPTION_ACTIVE_KEY_VERSION: v.optional(v.number()),
    ENCRYPTION_ACTIVE_AAD_VERSION: v.optional(v.number()),
    ENCRYPTION_SUPPORTED_AAD_VERSIONS: v.optional(v.string())
  }
});
