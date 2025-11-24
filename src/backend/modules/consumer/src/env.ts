import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  tokens: {
    CONSUMER_TOKEN_SECRET: v.string(),
    CONSUMER_SESSION_SECRET: v.string()
  }
});
