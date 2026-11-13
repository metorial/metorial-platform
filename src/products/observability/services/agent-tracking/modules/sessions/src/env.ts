import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let recordsSettings = defineSettings('records', {
  hashSecret: setting(v.string(), {
    env: 'AGENT_TRACKING_HASH_SECRET',
    audience: 'deployment',
    secret: true,
    description:
      'Root secret for the per-organization keys that hash content and derive record ids.'
  })
});

export let env = {
  ...serviceSettings,
  records: recordsSettings
};
