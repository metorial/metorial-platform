import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  secrets: {
    OUTPOST_KEY_ENCRYPTION_SECRET: v.string()
  },

  urls: {
    OUTPOST_REGIONAL_API_URL: v.optional(v.string())
  }
});
