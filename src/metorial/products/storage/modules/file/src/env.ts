import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';

export let env = createValidatedEnv({
  service: {
    METORIAL_REGION: v.optional(v.string()),
    DOWNLOAD_PUBLIC_URL: v.optional(v.string()),
    SIGNED_DOWNLOAD_URL_TOKEN_SECRET: v.string(),
    UPLOAD_HOST: v.optional(v.string()),
    SIGNED_UPLOAD_URL_TOKEN_SECRET: v.optional(v.string()),
    /// Shared with the file router worker. When unset, the worker handshake is
    /// disabled and every download is served straight from this API.
    FILE_ROUTER_SECRET: v.optional(v.string())
  },
  storage: {
    OBJECT_STORAGE_URL: v.string(),
    FILES_BUCKET_NAME: v.string()
  }
});
