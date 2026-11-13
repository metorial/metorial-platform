import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { getStore } from '@mtsrc/agent-tracking-store';
import { recordReadbackService, toRecordDocument } from '@mtsrc/agent-tracking-module-records';
import type { SummaryRecord } from './summary';

let epoch = new Date(0);

let summaryProjection = {
  _id: 1,
  type: 1,
  occurredAt: 1,
  observedAt: 1,
  durationMs: 1,
  source: 1,
  ingest: 1,
  client: 1,
  ctx: 1,
  data: 1,
  attribution: 1
} as const;

// The memory sink (development and e2e) keeps records in process only; reading it through the
// stored mapping keeps the aggregation on one document shape.
let memoryRecords = async function* (d: { organizationId: string; sessionKey: string }) {
  for (let item of await recordReadbackService.list({ organizationId: d.organizationId })) {
    if (item.record.kind != 'event' || item.record.ctx.session_key != d.sessionKey) continue;

    let mapped = toRecordDocument(item.record, { storage: defaultStoragePolicy, now: epoch });
    if (mapped) yield mapped.document as SummaryRecord;
  }
};

export let sessionEvents = async (d: {
  organizationId: string;
  sessionKey: string;
}): Promise<AsyncIterable<SummaryRecord> | Iterable<SummaryRecord>> => {
  if (recordReadbackService.isAvailable()) return memoryRecords(d);

  let store = getStore();
  await store.ready();

  return store
    .collections()
    .events.find<SummaryRecord>(
      { organizationId: d.organizationId, 'ctx.sessionKey': d.sessionKey },
      { projection: summaryProjection }
    )
    .sort({ occurredAt: 1 });
};
