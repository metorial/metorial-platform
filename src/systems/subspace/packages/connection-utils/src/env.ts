import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  storage: {
    OBJECT_STORAGE_URL: v.string(),
    MESSAGE_BUCKET_NAME: v.string()
  }
});
