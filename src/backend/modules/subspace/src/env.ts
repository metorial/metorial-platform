import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string(),
    SUBSPACE_CONNECTION_URL: v.string()
  }
});
