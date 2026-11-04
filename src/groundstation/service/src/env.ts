import { v } from '@lowerdeck/validation';
import { defineSettings } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    GROUNDSTATION_API_PORT: v.optional(v.number()),
    GROUNDSTATION_INGEST_PORT: v.optional(v.number())
  }
});
