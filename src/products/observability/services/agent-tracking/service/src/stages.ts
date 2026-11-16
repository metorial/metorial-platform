import { createAttributionStage } from '@mtsrc/agent-tracking-module-identity';
import { configureIngestStages } from '@mtsrc/agent-tracking-module-ingest';
import { createSessionStage } from '@mtsrc/agent-tracking-module-sessions';
import { isStoreConfigured } from '@mtsrc/agent-tracking-store';

configureIngestStages(() => [
  createAttributionStage(),
  ...(isStoreConfigured() ? [createSessionStage()] : [])
]);
