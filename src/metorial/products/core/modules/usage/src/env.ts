import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  db: {
    USAGE_MONGO_URL: v.optional(v.string())
  }
});
