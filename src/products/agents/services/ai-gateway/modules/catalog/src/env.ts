import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let catalogSettings = defineSettings('catalog', {
  url: setting(v.string(), {
    env: 'AI_GATEWAY_CATALOG_URL',
    audience: 'deployment',
    default: 'https://models.metorial.com',
    description:
      'Base URL of the published model catalog (fingerprint.json and catalog.json.gz), or a file:// directory with the same layout.'
  }),

  pollMinutes: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AI_GATEWAY_CATALOG_POLL_MINUTES',
    audience: 'deployment',
    default: 5,
    description:
      'How often the catalog fingerprint is checked for a new publish. 0 disables syncing; the gateway then only knows models that were synced before.'
  })
});

export let env = {
  ...serviceSettings,
  catalog: catalogSettings
};
