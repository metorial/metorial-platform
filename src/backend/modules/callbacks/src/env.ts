import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  callbacks: {
    CALLBACKS_URL: v.string()
  }
});
