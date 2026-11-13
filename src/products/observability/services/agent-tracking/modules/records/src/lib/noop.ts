import type { RecordSink } from '@mtsrc/agent-tracking-store';

export let createNoopSink = (): RecordSink => ({
  write: async () => {}
});
