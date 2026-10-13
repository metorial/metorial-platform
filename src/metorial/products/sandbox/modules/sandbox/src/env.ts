import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  genesis: {
    SANDBOX_REGIONS: v.optional(v.string()),
    GENESIS_INTERNAL_URL: v.optional(v.string())
  }
});
