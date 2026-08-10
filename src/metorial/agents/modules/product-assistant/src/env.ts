import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_URL: v.string(),
    SUBSPACE_CONNECTION_URL: v.string(),
    SUBSPACE_SOLUTION: v.string()
  },

  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
