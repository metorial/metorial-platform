import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';

// Not stored as documents because nothing reads them. Every ingest stage still sees them
// (sessions, identity and context are derived from them), and unknown events are counted in
// source health.
let isUnstoredRecord = (record: NormalizedRecord) =>
  record.type == 'unmapped' ||
  (record.type == 'extension.event' &&
    record.data.kind == 'plugin' &&
    record.data.action == 'loaded');

export let storedRecords = (records: NormalizedRecord[]) =>
  records.filter(record => !isUnstoredRecord(record));
