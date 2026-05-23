import { createValidatedEnv } from '@mtsrc/env';
import { v } from '@mtsrc/validation';

export let env = createValidatedEnv({
  service: {
    DATABASE_URL: v.string(),

    PUBLIC_SERVICE_URL: v.string()
  }
});
