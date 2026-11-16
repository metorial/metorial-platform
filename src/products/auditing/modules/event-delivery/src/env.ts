import { defineSettings } from '@metorial/settings';
import { objectStorageUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    EVENT_PAYLOADS_BUCKET_NAME: v.string(),
    CHAT_EVENT_PAYLOADS_BUCKET_NAME: v.string(),
    EVENT_DELIVERY_PAYLOADS_BUCKET_NAME: v.string()
  }
});
