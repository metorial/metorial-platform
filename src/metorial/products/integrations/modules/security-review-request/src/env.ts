import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  generation: {
    SECURITY_REVIEW_AUTO_GENERATION: v.optional(v.enumOf(['true', 'false']))
  }
});
