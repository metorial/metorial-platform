import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    METORIAL_REGION: v.optional(v.enumOf(['us1', 'eu1']))
  },

  storage: {
    OBJECT_STORAGE_URL: v.string(),
    FILES_BUCKET_NAME: v.string()
  }
});
