import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let ingestSettings = defineSettings('ingest', {
  hashSecret: setting(v.string(), {
    env: 'AGENT_TRACKING_HASH_SECRET',
    audience: 'deployment',
    secret: true,
    description:
      'Root secret for the per-organization keys that hash content and derive record ids.'
  })
});

export let env = {
  ingest: ingestSettings
};
