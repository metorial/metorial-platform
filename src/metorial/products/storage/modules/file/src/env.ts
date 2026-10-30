import { defineSettings } from '@metorial/settings';
import { metorialRegion, objectStorageUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    METORIAL_REGION: metorialRegion,
    DOWNLOAD_PUBLIC_URL: v.optional(v.string()),
    SIGNED_DOWNLOAD_URL_TOKEN_SECRET: v.string(),
    UPLOAD_HOST: v.optional(v.string()),
    SIGNED_UPLOAD_URL_TOKEN_SECRET: v.optional(v.string()),
    FILE_ROUTER_SECRET: v.optional(v.string())
  },
  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    FILES_BUCKET_NAME: v.string()
  }
});
