import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    LOGS_BUCKET_NAME: v.string()
  }
});
