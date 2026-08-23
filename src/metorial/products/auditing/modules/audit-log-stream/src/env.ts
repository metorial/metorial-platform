import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  secrets: {
    ENCRYPTION_SECRET: v.string()
  }
});
