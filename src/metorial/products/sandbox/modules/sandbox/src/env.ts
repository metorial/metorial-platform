import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  genesis: {
    GENESIS_INTERNAL_URL: v.optional(v.string())
  }
});
