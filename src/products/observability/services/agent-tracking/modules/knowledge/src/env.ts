import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let knowledgeSettings = defineSettings('knowledge', {
  guardrails: setting(v.enumOf(['strict', 'off']), {
    env: 'AGENT_TRACKING_MODEL_KNOWLEDGE_GUARDRAILS',
    audience: 'deployment',
    default: 'strict',
    description:
      'Whether snapshots that look like a bad publish (mass price changes, dropped models, reset history) are rejected.'
  }),

  pollMinutes: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'AGENT_TRACKING_MODEL_KNOWLEDGE_POLL_MINUTES',
    audience: 'deployment',
    default: 2,
    description:
      'How often the fingerprint is checked for a new publish. 0 disables syncing; sessions then carry no canonical model ids or computed cost until a snapshot is imported.'
  }),

  url: setting(v.string(), {
    env: 'AGENT_TRACKING_MODEL_KNOWLEDGE_URL',
    audience: 'deployment',
    default: 'https://models.metorial.com',
    description:
      'Base URL of the published model knowledge (fingerprint.json and catalog.json.gz), or a file:// directory with the same layout.'
  })
});

export let env = {
  ...serviceSettings,
  knowledge: knowledgeSettings
};
