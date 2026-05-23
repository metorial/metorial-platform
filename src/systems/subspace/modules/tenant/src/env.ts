import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    SHUTTLE_URL: v.optional(v.string()),
    SLATES_HUB_URL: v.optional(v.string())
  }
});
