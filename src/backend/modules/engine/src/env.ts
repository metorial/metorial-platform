import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  engine: {
    ENGINE_MANAGER_ADDRESSES: v.string()
  }
});
