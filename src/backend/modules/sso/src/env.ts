import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  sso: {
    SSO_SERVICE_RPC_URL: v.string()
  }
});
