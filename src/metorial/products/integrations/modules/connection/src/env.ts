import { defineSettings } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    NATS_URL: v.string()
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    MESSAGE_BUCKET_NAME: v.string()
  }
});
