import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  service: {
    VOYAGER_URL: v.optional(v.string()),
    VOYAGER_INDEX_PREFIX: v.optional(v.string())
  }
});
