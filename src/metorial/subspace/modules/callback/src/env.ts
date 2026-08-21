import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    SIGNAL_API_URL: v.string(),
    SIGNAL_SERVICE_CREDENTIAL: v.optional(v.string({ modifiers: [v.minLength(1)] }))
  }
});
