import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    SYNTHESIS_API_PORT: v.number(),
    SYNTHESIS_HEALTH_PORT: v.number(),
    DATABASE_URL: v.string(),
    REDIS_URL: v.string()
  },

  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
