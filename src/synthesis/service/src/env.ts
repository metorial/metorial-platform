import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    SYNTHESIS_API_PORT: v.number(),
    SYNTHESIS_HEALTH_PORT: v.number(),
    DATABASE_URL: v.string(),
    REDIS_URL: v.string()
  }
});
