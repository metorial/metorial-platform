import { defineSettings } from '@metorial/settings';
import { objectStorageUrl, redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    SIGNAL_API_PORT: v.optional(v.number())
  },

  storage: {
    OBJECT_STORAGE_URL: objectStorageUrl,
    LOGS_BUCKET_NAME: v.string()
  }
});
