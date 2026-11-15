import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let storageSettings = defineSettings({
  storage: {
    OBJECT_STORAGE_URL: setting(v.optional(v.string()), {
      env: 'OBJECT_STORAGE_URL',
      audience: 'deployment',
      description: 'Object storage connection URL. Query exports are unavailable without it.'
    })
  }
});

let querySettings = defineSettings('query', {
  hashSecret: setting(v.string(), {
    env: 'AGENT_TRACKING_HASH_SECRET',
    audience: 'deployment',
    secret: true,
    description:
      'Root secret for the per-organization keys; queries derive their cursor signing key from it.'
  }),
  exportBucket: setting(v.string(), {
    env: 'AGENT_TRACKING_EXPORT_BUCKET',
    audience: 'deployment',
    default: 'agent-tracking-exports',
    description: 'Object-store bucket that query exports are written to.'
  })
});

export let env = {
  ...serviceSettings,
  ...storageSettings,
  query: querySettings
};
