import { defineSettings } from '@metorial/settings';
import { objectStorageUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    MESSAGE_BUCKET_NAME: v.string(),
    PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME: v.optional(v.string())
  }
});
