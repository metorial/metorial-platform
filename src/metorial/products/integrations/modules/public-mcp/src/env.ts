import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    REDIS_URL: v.string(),

    INTEGRATIONS_UI_URL: v.string()
  }
});
