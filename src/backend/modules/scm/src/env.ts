import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  gh: {
    SCM_GITHUB_CLIENT_ID: v.string(),
    SCM_GITHUB_CLIENT_SECRET: v.string()
  }
});
