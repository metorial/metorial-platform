import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let recordsSettings = defineSettings('records', {
  contentSecret: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_CONTENT_SECRET',
    audience: 'deployment',
    secret: true,
    description: 'Root secret for the per-organization keys that encrypt stored content text.'
  })
});

let classificationSettings = defineSettings('classification', {
  clefAccountId: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_CLEF_ACCOUNT_ID',
    audience: 'deployment',
    description:
      'Cloudflare account that runs the clef classification model. Without it the AI stage is off.'
  }),

  clefApiToken: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_CLEF_API_TOKEN',
    audience: 'deployment',
    secret: true,
    description: 'Workers AI API token for the clef classification model.'
  })
});

export let env = {
  ...serviceSettings,
  records: recordsSettings,
  classification: classificationSettings
};
