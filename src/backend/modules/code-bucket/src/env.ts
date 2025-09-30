import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  codeWorkspace: {
    CODE_WORKSPACE_SERVICE_ADDRESS: v.string()
  }
});
