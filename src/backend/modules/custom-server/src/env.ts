import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  deno: {
    DENO_DEPLOY_TOKEN: v.optional(v.string()),
    DENO_ORGANIZATION_ID: v.optional(v.string()),

    DENO_RUNNER_ADDRESS: v.optional(v.string())
  }
});
