import { v } from '@lowerdeck/validation';
import { defineSettings } from '@metorial/settings';
import { emailTransportSettings, redisUrl } from '@metorial/shared-settings';

export let env = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    RELAY_PORT: v.optional(v.number())
  }
});

export let emailSettings = emailTransportSettings();
