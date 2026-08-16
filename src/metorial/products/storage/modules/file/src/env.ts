import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    METORIAL_REGION: v.optional(v.string()),
    DOWNLOAD_PUBLIC_URL: v.optional(v.string()),
    SIGNED_DOWNLOAD_URL_TOKEN_SECRET: v.string()
  },
  storage: {
    OBJECT_STORAGE_URL: v.string(),
    FILES_BUCKET_NAME: v.string()
  }
});
