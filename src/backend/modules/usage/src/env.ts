import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  db: {
    USAGE_MONGO_URL: v.optional(v.string())
  }
});
