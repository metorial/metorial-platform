import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    METORIAL_REGION: v.optional(v.enumOf(['us1', 'eu1', 'dev']))
  }
});
