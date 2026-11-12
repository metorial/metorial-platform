import type { RecordSink } from './types';

export let createNoopSink = (): RecordSink => ({
  write: async () => {}
});
