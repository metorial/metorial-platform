import { defineSettings } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let serviceSettings = defineSettings({
  service: {
    AGENT_TRACKING_API_PORT: v.optional(v.number()),
    AGENT_TRACKING_INGEST_PORT: v.optional(v.number())
  }
});

export let env = {
  ...serviceSettings
};
