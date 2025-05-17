import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  db: {
    USAGE_MONGO_URL: v.optional(v.string())
  }
});
