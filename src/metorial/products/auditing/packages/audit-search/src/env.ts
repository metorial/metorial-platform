import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    VOYAGER_URL: v.string(),
    VOYAGER_INDEX_PREFIX: v.optional(v.string())
  }
});
