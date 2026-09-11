import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    REDIS_URL: v.string()
  },

  origin: {
    ORIGIN_URL: v.string()
  }
});
