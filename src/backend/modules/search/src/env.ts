import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    VOYAGER_URL: v.optional(v.string()),
    VOYAGER_INDEX_PREFIX: v.optional(v.string())
  }
});
