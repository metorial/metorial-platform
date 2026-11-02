import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  db: {
    USAGE_MONGO_URL: v.optional(v.string())
  }
});
