import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  deno: {
    DENO_DEPLOY_TOKEN: v.optional(v.string()),
    DENO_ORGANIZATION_ID: v.optional(v.string()),

    DENO_RUNNER_ADDRESS: v.optional(v.string())
  },

  python: {
    PYTHON_RUNNER_ADDRESS: v.optional(v.string())
  },

  aws: {
    AWS_ACCESS_KEY_ID: v.optional(v.string()),
    AWS_SECRET_ACCESS_KEY: v.optional(v.string()),
    AWS_REGION: v.optional(v.string()),
    AWS_ACCOUNT_ID: v.optional(v.string()),
    LAMBDA_DEPLOY_RESOURCE_PREFIX: v.optional(v.string())
  }
});
