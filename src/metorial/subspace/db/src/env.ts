import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    DATABASE_URL: v.string(),

    INTEGRATIONS_API_URL: v.string()
  }
});
