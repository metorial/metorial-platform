import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string(),
    DATABASE_URL: v.string(),
    RELAY_URL: v.string()
  },

  email: {
    EMAIL_NAME: v.string(),
    EMAIL_ADDRESS: v.string()
  }
});
