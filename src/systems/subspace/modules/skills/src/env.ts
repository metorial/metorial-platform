import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  cargo: {
    CARGO_API_URL: v.string()
  }
});
