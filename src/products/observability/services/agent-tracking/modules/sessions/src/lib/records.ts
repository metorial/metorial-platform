import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { getStore } from '@mtsrc/agent-tracking-store';
import { recordReadbackService, toRecordDocument } from '@mtsrc/agent-tracking-module-records';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import type { SummaryRecord } from './summary';
import {
  compareRecords,
  isMcpToolCall,
  mcpToolCallMatch,
  toolCallProjection,
  type ToolCallRecord,
  type ToolCallRecordReader,
  type ToolCallRef
} from './toolCalls';

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
  attribution: 1,
  metorial: 1
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

// Measurements have no index on their session key, so the lookup is bounded by the session's own
// time range, which covers every measurement written to it, and uses the instance and time index.
export let sessionHasMeasurements = async (
  session: Pick<
    SessionDocument,
    '_id' | 'organizationId' | 'instanceId' | 'startedAt' | 'lastActivityAt'
  >
) => {
  if (recordReadbackService.isAvailable()) {
    let stored = await recordReadbackService.list({ organizationId: session.organizationId });

    return stored.some(
      ({ record }) => record.kind == 'measurement' && record.ctx.session_key == session._id
    );
  }

  let store = getStore();
  await store.ready();

  let found = await store.collections().measurements.findOne(
    {
      organizationId: session.organizationId,
      instanceId: session.instanceId,
      occurredAt: { $gte: session.startedAt, $lte: session.lastActivityAt },
      'ctx.sessionKey': session._id
    },
    { projection: { _id: 1 } }
  );

  return !!found;
};

let memoryToolCalls = async (d: {
  organizationId: string;
  instanceId?: string;
  match: (document: ToolCallRecord) => boolean;
}) => {
  let stored = await recordReadbackService.list({
    organizationId: d.organizationId,
    ...(d.instanceId ? { instanceId: d.instanceId } : {})
  });

  let documents: ToolCallRecord[] = [];
  for (let item of stored) {
    if (item.record.kind != 'event' || item.record.type != 'tool.call') continue;

    let mapped = toRecordDocument(item.record, { storage: defaultStoragePolicy, now: epoch });
    if (mapped && d.match(mapped.document)) documents.push(mapped.document);
  }

  return documents.sort(compareRecords);
};

export let sessionMcpToolCallFilter = (d: { organizationId: string; sessionKey: string }) => ({
  organizationId: d.organizationId,
  'ctx.sessionKey': d.sessionKey,
  ...mcpToolCallMatch
});

export let toolCallLookupFilter = (d: {
  organizationId: string;
  instanceId: string;
  call: ToolCallRef;
}) => ({
  organizationId: d.organizationId,
  instanceId: d.instanceId,
  'ctx.toolCallId': d.call.toolCallId,
  'client.family': d.call.clientFamily,
  type: 'tool.call',
  'ctx.sessionKey': { $exists: true }
});

export let sessionMcpToolCallRecords = async (d: {
  organizationId: string;
  sessionKey: string;
}): Promise<AsyncIterable<ToolCallRecord> | Iterable<ToolCallRecord>> => {
  if (recordReadbackService.isAvailable()) {
    return await memoryToolCalls({
      organizationId: d.organizationId,
      match: document => document.ctx.sessionKey == d.sessionKey && isMcpToolCall(document)
    });
  }

  let store = getStore();
  await store.ready();

  return store
    .collections()
    .events.find<ToolCallRecord>(sessionMcpToolCallFilter(d), {
      projection: toolCallProjection
    })
    .sort({ occurredAt: 1 });
};

export let toolCallRecordReader = async (d: {
  organizationId: string;
  instanceId: string;
}): Promise<ToolCallRecordReader> => {
  if (recordReadbackService.isAvailable()) {
    let documents = await memoryToolCalls({ ...d, match: () => true });

    return async ({ call, limit }) =>
      documents
        .filter(
          document =>
            document.ctx.toolCallId == call.toolCallId &&
            document.client.family == call.clientFamily &&
            !!document.ctx.sessionKey
        )
        .slice(0, limit);
  }

  let store = getStore();
  await store.ready();

  let events = store.collections().events;

  return async ({ call, limit }) =>
    await events
      .find<ToolCallRecord>(toolCallLookupFilter({ ...d, call }), {
        projection: toolCallProjection,
        limit
      })
      .toArray();
};

export type ToolCallPairReader = (d: {
  clientFamily: string;
  toolCallIds: string[];
  limit: number;
}) => Promise<ToolCallRecord[]>;

export let toolCallPairReader = async (d: {
  organizationId: string;
  instanceId: string;
}): Promise<ToolCallPairReader> => {
  if (recordReadbackService.isAvailable()) {
    let documents = await memoryToolCalls({ ...d, match: () => true });

    return async ({ clientFamily, toolCallIds, limit }) => {
      let ids = new Set(toolCallIds);

      return documents
        .filter(
          document =>
            document.client.family == clientFamily &&
            !!document.ctx.toolCallId &&
            ids.has(document.ctx.toolCallId) &&
            !!document.ctx.sessionKey
        )
        .slice(0, limit);
    };
  }

  let store = getStore();
  await store.ready();

  let events = store.collections().events;

  return async ({ clientFamily, toolCallIds, limit }) =>
    await events
      .find<ToolCallRecord>(
        {
          organizationId: d.organizationId,
          instanceId: d.instanceId,
          'ctx.toolCallId': { $in: toolCallIds },
          'client.family': clientFamily,
          type: 'tool.call',
          'ctx.sessionKey': { $exists: true }
        },
        { projection: toolCallProjection, limit }
      )
      .toArray();
};
