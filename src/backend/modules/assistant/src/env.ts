import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    SYNTHESIS_API_URL: v.string()
  }
});
