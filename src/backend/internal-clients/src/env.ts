import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    CARGO_API_URL: v.string(),
    SYNTHESIS_API_URL: v.string()
  },

  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string()
  }
});
