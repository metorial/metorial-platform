import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let agentTelemetrySettings = defineSettings('agentTelemetry', {
  groundstationUrl: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_URL',
    audience: 'deployment',
    description:
      'Internal URL of the Groundstation RPC API, including its /metorial-groundstation path. Agent telemetry sync is off while unset.'
  }),
  groundstationIngestPublicUrl: setting(v.optional(v.string()), {
    env: 'GROUNDSTATION_INGEST_PUBLIC_URL',
    audience: 'deployment',
    description:
      'Public base URL of the Groundstation ingest endpoint that Metorial Desktop sends agent telemetry to. Desktop ingest tokens are not issued while unset.'
  })
});
