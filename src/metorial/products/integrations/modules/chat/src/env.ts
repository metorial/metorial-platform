import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: v.string()
  },
  storage: {
    OBJECT_STORAGE_URL: v.string(),
    CHAT_EVENT_PAYLOADS_BUCKET_NAME: v.string()
  }
});
