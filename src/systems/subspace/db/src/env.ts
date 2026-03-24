import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    DATABASE_URL: v.string(),

    PUBLIC_SERVICE_URL: v.string()
  }
});
