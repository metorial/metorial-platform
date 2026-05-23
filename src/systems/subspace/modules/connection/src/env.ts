import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    NATS_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    MESSAGE_BUCKET_NAME: v.string()
  }
});
