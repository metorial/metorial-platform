import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl,
    DATABASE_URL: v.string(),

    GROUNDSTATION_API_PORT: v.optional(v.number()),
    GROUNDSTATION_INGEST_PORT: v.optional(v.number())
  }
});

let recordSettings = defineSettings('records', {
  hashSecret: setting(v.string(), {
    env: 'GROUNDSTATION_HASH_SECRET',
    audience: 'deployment',
    secret: true,
    description:
      'Root secret for the per-organization keys that hash content and derive record ids.'
  }),

  sink: setting(v.optional(v.enumOf(['noop', 'memory', 'ndjson', 'mongo'])), {
    env: 'GROUNDSTATION_SINK',
    audience: 'deployment',
    description:
      'Where normalized records go: mongo stores them; the others are for development.'
  }),

  mongoUrl: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_MONGO_URL',
    audience: 'deployment',
    secret: true,
    description: 'MongoDB (DocumentDB in production) database that stores normalized records.'
  }),

  contentSecret: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_CONTENT_SECRET',
    audience: 'deployment',
    secret: true,
    description: 'Root secret for the per-organization keys that encrypt stored content text.'
  }),

  sinkFile: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_SINK_FILE',
    audience: 'deployment',
    description: 'Target file of the ndjson sink.'
  })
});

let ingestSettings = defineSettings('ingest', {
  trustedProxyHops: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'GROUNDSTATION_TRUSTED_PROXY_HOPS',
    audience: 'deployment',
    default: 1,
    description:
      'Proxies in front of the ingest server that append to X-Forwarded-For; the client IP is the entry this many hops from the right (0 uses the socket address).'
  })
});

let knowledgeSettings = defineSettings('knowledge', {
  url: setting(v.string(), {
    env: 'GROUNDSTATION_MODEL_KNOWLEDGE_URL',
    audience: 'deployment',
    default: 'https://models.metorial.com',
    description:
      'Base URL of the published model knowledge (fingerprint.json and catalog.json.gz), or a file:// directory with the same layout.'
  }),

  pollMinutes: setting(v.number({ modifiers: [v.integer()] }), {
    env: 'GROUNDSTATION_MODEL_KNOWLEDGE_POLL_MINUTES',
    audience: 'deployment',
    default: 2,
    description:
      'How often the fingerprint is checked for a new publish. 0 disables syncing; sessions then carry no canonical model ids or computed cost until a snapshot is imported.'
  }),

  guardrails: setting(v.enumOf(['strict', 'off']), {
    env: 'GROUNDSTATION_MODEL_KNOWLEDGE_GUARDRAILS',
    audience: 'deployment',
    default: 'strict',
    description:
      'Whether snapshots that look like a bad publish (mass price changes, dropped models, reset history) are rejected.'
  })
});

let classificationSettings = defineSettings('classification', {
  clefAccountId: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_CLEF_ACCOUNT_ID',
    audience: 'deployment',
    description:
      'Cloudflare account that runs the clef classification model. Without it the AI stage is off.'
  }),

  clefApiToken: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_CLEF_API_TOKEN',
    audience: 'deployment',
    secret: true,
    description: 'Workers AI API token for the clef classification model.'
  })
});

export let env = {
  ...serviceSettings,
  records: recordSettings,
  ingest: ingestSettings,
  knowledge: knowledgeSettings,
  classification: classificationSettings
};
