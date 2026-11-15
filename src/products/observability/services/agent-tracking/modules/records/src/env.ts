import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { redisUrl } from '@metorial/shared-settings';

let serviceSettings = defineSettings({
  service: {
    REDIS_URL: redisUrl
  }
});

let sinkSettings = defineSettings('records', {
  contentSecret: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_CONTENT_SECRET',
    audience: 'deployment',
    secret: true,
    description: 'Root secret for the per-organization keys that encrypt stored content text.'
  }),

  sink: setting(v.optional(v.enumOf(['noop', 'memory', 'ndjson', 'mongo'])), {
    env: 'AGENT_TRACKING_SINK',
    audience: 'deployment',
    description:
      'Where normalized records go: mongo stores them; the others are for development.'
  }),

  sinkFile: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_SINK_FILE',
    audience: 'deployment',
    description: 'Target file of the ndjson sink.'
  })
});

export let env = {
  ...serviceSettings,
  records: sinkSettings
};
