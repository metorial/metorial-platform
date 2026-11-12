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
    description: 'Root secret for the per-tenant keys that hash content and derive record ids.'
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
    description: 'Root secret for the per-tenant keys that encrypt stored content text.'
  }),

  sinkFile: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_SINK_FILE',
    audience: 'deployment',
    description: 'Target file of the ndjson sink.'
  })
});

export let env = { ...serviceSettings, records: recordSettings };
