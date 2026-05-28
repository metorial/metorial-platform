import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    CARGO_API_URL: v.string(),
    SYNTHESIS_API_URL: v.string(),
    NEBULA_API_URL: v.string()
  },

  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string()
  }
});
