import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string(),
    SUBSPACE_CONNECTION_URL: v.string()
  }
});
