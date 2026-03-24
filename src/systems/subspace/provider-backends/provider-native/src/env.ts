import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  scout: {
    SCOUT_URL: v.optional(v.string()),
    SCOUT_TOKEN: v.optional(v.string())
  }
});
