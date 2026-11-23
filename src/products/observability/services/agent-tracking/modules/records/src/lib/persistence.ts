import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';

// Not stored: nothing reads them. Ingest stages still see them, and unknown events are counted
// in source health.
let isUnstoredRecord = (record: NormalizedRecord) =>
  record.type == 'unmapped' ||
  (record.type == 'extension.event' &&
    record.data.kind == 'plugin' &&
    record.data.action == 'loaded');

export let storedRecords = (records: NormalizedRecord[]) =>
  records.filter(record => !isUnstoredRecord(record));
