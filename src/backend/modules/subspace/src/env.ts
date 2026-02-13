import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string(),
    SUBSPACE_URL_CONNECTION: v.optional(v.string())
  }
});
