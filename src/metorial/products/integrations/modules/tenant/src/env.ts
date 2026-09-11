import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    SHUTTLE_URL: v.optional(v.string()),
    SLATES_HUB_URL: v.optional(v.string()),
    SUBSPACE_SOLUTION: v.string()
  }
});
