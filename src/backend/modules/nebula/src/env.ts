import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  nebula: {
    NEBULA_API_URL: v.string()
  }
});
