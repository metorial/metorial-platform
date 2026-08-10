import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    NEBULA_API_URL: v.string()
  },

  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string()
  }
});
