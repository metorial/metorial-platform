import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let agentTrackingSettings = defineSettings('agentTracking', {
  url: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_URL',
    audience: 'deployment',
    description:
      'Internal URL of the agent-tracking RPC API, including its /metorial-agent-tracking path. Agent tracking is off while unset. It runs only for organizations with the agent-tracking-enabled flag; without the enterprise flag service, add agent-tracking-enabled to METORIAL_ENABLED_FLAGS.'
  }),
  ingestPublicUrl: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_INGEST_PUBLIC_URL',
    audience: 'deployment',
    description:
      'Public base URL of the agent-tracking ingest endpoint that Metorial Desktop sends agent telemetry to. Desktop ingest tokens and ingestion keys are not issued while unset.'
  })
});
