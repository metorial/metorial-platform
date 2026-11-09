import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: { METORIAL_REGION: v.optional(v.enumOf(['us1', 'eu1', 'dev'])) },
  genesis: {
    SANDBOX_SIGNATURE_CREDENTIALS: v.optional(v.string()),
    SANDBOX_REGIONS: v.optional(v.string()),
    GENESIS_INTERNAL_URL: v.optional(v.string())
  }
});
