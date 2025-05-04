import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  smtp: {
    EMAIL_HOST: v.string(),
    EMAIL_PORT: v.number(),
    EMAIL_SECURE: v.boolean(),
    EMAIL_USER: v.string(),
    EMAIL_PASS: v.string(),
    EMAIL_FROM: v.string(),
    EMAIL_FROM_NAME: v.string()
  }
});
