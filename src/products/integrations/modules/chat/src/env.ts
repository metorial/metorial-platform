import { defineSettings } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl
  },
  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    CHAT_EVENT_PAYLOADS_BUCKET_NAME: v.string()
  }
});
