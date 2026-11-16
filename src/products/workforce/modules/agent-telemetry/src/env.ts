import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let agentTelemetrySettings = defineSettings('agentTelemetry', {
  groundstationUrl: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_URL',
    audience: 'deployment',
    description:
      'Internal URL of the agent-tracking RPC API, including its /metorial-agent-tracking path. Agent telemetry sync is off while unset.'
  }),
  groundstationIngestPublicUrl: setting(v.optional(v.string()), {
    env: 'AGENT_TRACKING_INGEST_PUBLIC_URL',
    audience: 'deployment',
    description:
      'Public base URL of the agent-tracking ingest endpoint that Metorial Desktop sends agent telemetry to. Desktop ingest tokens are not issued while unset.'
  })
});
