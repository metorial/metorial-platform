import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let recordsSettings = defineSettings('records', {
  mongoUrl: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_MONGO_URL',
    audience: 'deployment',
    secret: true,
    description: 'MongoDB (DocumentDB in production) database that stores normalized records.'
  }),

  liveWriteLanes: setting(v.number({ modifiers: [v.integer(), v.minValue(1)] }), {
    env: 'AGENT_TRACKING_LIVE_WRITE_LANES',
    audience: 'deployment',
    default: 16,
    description:
      'Record writes from live traffic one process runs at once before it answers sink_busy and the client retries. Counted per process, so the service-wide limit is this times the number of ingest tasks. Default 16.'
  }),

  backfillWriteLanes: setting(v.number({ modifiers: [v.integer(), v.minValue(1)] }), {
    env: 'AGENT_TRACKING_BACKFILL_WRITE_LANES',
    audience: 'deployment',
    default: 4,
    description:
      'Record writes from backfill one process runs at once, kept apart from the live lanes so a backfill cannot starve live traffic. Counted per process, like the live lanes. Default 4.'
  })
});

export let env = {
  records: recordsSettings
};
