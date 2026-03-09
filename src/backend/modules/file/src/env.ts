import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  storage: {
    OBJECT_STORAGE_URL: v.string(),
    FILES_BUCKET_NAME: v.string()
  }
});
