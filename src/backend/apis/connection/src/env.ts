import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_CONNECTION_URL: v.string(),
    SUBSPACE_SOLUTION: v.string()
  }
});
