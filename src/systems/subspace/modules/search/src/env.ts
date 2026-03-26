import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    VOYAGER_URL: v.string(),
    VOYAGER_INDEX_PREFIX: v.optional(v.string())
  }
});
