import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  origin: {
    ORIGIN_URL: v.string(),
    CODE_BUCKET_SERVICE_URL: v.string()
  }
});
