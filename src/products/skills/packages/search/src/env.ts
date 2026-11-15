import { defineSettings } from '@metorial/settings';
import { serviceUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    VOYAGER_URL: serviceUrl('voyager'),
    VOYAGER_INDEX_PREFIX: v.optional(v.string())
  }
});
