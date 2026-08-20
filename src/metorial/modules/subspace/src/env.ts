import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  subspace: {
    SUBSPACE_SOLUTION: v.string(),
    SUBSPACE_URL: v.string(),
    SUBSPACE_CALLBACK_SECURITY_URL: v.string(),
    SUBSPACE_CORE_RPC_TOKEN_CURRENT: v.string(),
    SUBSPACE_CONNECTION_URL: v.string()
  }
});
