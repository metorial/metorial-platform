import type { NormalizedRecord, RecordKind } from '@metorial/groundstation-spec';
import { computeRequestCost, getCatalog, type CatalogIndex } from '../catalog';
import { sessionlessKey } from '../facts/slices';
import { writeSessionFacts, type BaseSlice } from '../facts/write';
import { getRuntime } from '../runtime';
import { defaultStoragePolicy } from '../sink/types';
import { getStore } from '../store/connection';
import { toRecordDocument } from '../store/mapper';
import type { RecordDocument } from '../store/models';
import { bucketStart, type BucketMinutes } from './buckets';
import { parseAmount, toDecimal, type Amount } from './decimal';
import {
  addCost,
  addTokens,
  emptyTokens,
  readCost,
  readTokens,
  reportedCosts,
  selectCostBasis,
  preferredAmount,
  type CostEntry
} from './summary';

let dayMs = 24 * 60 * 60 * 1000;

let scanWindowMs = 2 * dayMs;

let epoch = new Date(0);

// Families whose only usage source is aggregates (07 §5.6); every other family gets its usage from
// events, so their sessionless metric points carry nothing a slice counts.
export let aggregateUsageFamilies = new Set(['kiro']);

let usageMeasurements = new Set(['tokens', 'cost', 'requests']);

let countedRoles = new Set(['primary', 'aggregate']);

let tokenFields: Record<string, keyof ReturnType<typeof emptyTokens>> = {
  input: 'inputUncached',
  input_uncached: 'inputUncached',
  cache_read: 'cacheRead',
  cache_write: 'cacheWrite',
  output: 'output',
  reasoning: 'reasoning'
};

let failedOutcomes = new Set(['error', 'failure', 'failed']);

export type SessionlessRecord = Pick<
  RecordDocument,
  '_id' | 'type' | 'occurredAt' | 'source' | 'ingest' | 'client' | 'data' | 'attribution'
> & { kind: RecordKind };

let record = (value: unknown) =>
  typeof value == 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

let text = (value: unknown) => (typeof value == 'string' && value ? value : undefined);

let number = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) && value > 0 ? value : 0;

let date = (value: unknown) => {
  if (value instanceof Date) return value;
  if (typeof value != 'string') return undefined;

  let parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

export let sessionlessBucket = (d: {
  occurredAt: Date;
  window?: unknown;
}): { bucket: Date; bucketMinutes: BucketMinutes } => {
  let window = record(d.window);
  let start = date(window?.start) ?? d.occurredAt;
  let end = date(window?.end);

  let bucketMinutes: BucketMinutes =
    end && end.getTime() - start.getTime() >= dayMs ? 1440 : 15;

  return { bucket: bucketStart(start, bucketMinutes), bucketMinutes };
};

export let isSessionlessUsage = (record: NormalizedRecord) =>
  !record.ctx.session_key &&
  aggregateUsageFamilies.has(record.client.family) &&
  countedRoles.has(record.source.role) &&
  (record.kind == 'measurement'
    ? usageMeasurements.has(record.type)
    : record.source.role == 'aggregate');

let costUnit = (unit: string) => unit.replace(/[{}]/g, '').toLowerCase();

type SliceTotals = {
  slice: Omit<BaseSlice, 'costReported' | 'costComputedUsd' | 'costUsd'>;
  costs: Map<string, CostEntry>;
  computed?: Amount;
};

export let sessionlessBaseSlices = (d: {
  records: Iterable<SessionlessRecord>;
  bucket: Date;
  catalog: CatalogIndex | null;
}): BaseSlice[] => {
  let slices = new Map<string, SliceTotals>();

  for (let document of d.records) {
    if (!aggregateUsageFamilies.has(document.client.family)) continue;
    if (!countedRoles.has(document.source.role)) continue;

    let data = document.data ?? {};
    let placed = sessionlessBucket({ occurredAt: document.occurredAt, window: data.window });
    if (placed.bucket.getTime() != d.bucket.getTime()) continue;

    let isMeasurement = document.kind == 'measurement';
    if (
      isMeasurement &&
      (!usageMeasurements.has(document.type) || data.aggregation != 'delta')
    ) {
      continue;
    }

    let dims = record(data.dims) ?? {};
    let modelRaw = text(dims.model) ?? text(record(data.model)?.id);
    let provider = text(dims.provider) ?? text(record(data.model)?.provider);
    let modelId = modelRaw
      ? d.catalog?.resolveModel({
          raw: modelRaw,
          provider,
          family: document.client.family,
          at: document.occurredAt
        }).modelId
      : undefined;

    let attribution = document.attribution ?? {};
    let key = [
      placed.bucketMinutes,
      attribution.userId,
      attribution.deviceId,
      attribution.agentId,
      modelId ?? (modelRaw ? `raw:${modelRaw}` : '')
    ].join('\0');

    let totals = slices.get(key);
    if (!totals) {
      totals = {
        slice: {
          bucket: placed.bucket,
          bucketMinutes: placed.bucketMinutes,
          ...(modelId ? { modelId } : {}),
          ...(modelRaw ? { modelRaw } : {}),
          ...(provider ? { provider } : {}),
          ...(attribution.userId ? { userId: attribution.userId } : {}),
          ...(attribution.deviceId ? { deviceId: attribution.deviceId } : {}),
          ...(attribution.agentId ? { agentId: attribution.agentId } : {}),
          client: {
            family: document.client.family,
            ...(document.client.version ? { version: document.client.version } : {}),
            ...(document.client.surface ? { surface: document.client.surface } : {})
          },
          sessionsStarted: 0,
          turns: 0,
          requests: 0,
          failedRequests: 0,
          toolCalls: 0,
          tokens: emptyTokens(),
          lines: { added: 0, removed: 0 }
        },
        costs: new Map()
      };
      slices.set(key, totals);
    }

    if (!isMeasurement) {
      let tokens = readTokens(data.usage);
      if (tokens) addTokens(totals.slice.tokens, tokens);

      let cost = readCost(data.cost);
      if (cost) addCost(totals.costs, cost);

      continue;
    }

    let value = number(data.value);
    if (!value) continue;

    if (document.type == 'tokens') {
      let field = tokenFields[text(dims.tokenType) ?? ''];
      if (field) totals.slice.tokens[field] += value;
    }

    if (document.type == 'requests') {
      totals.slice.requests += value;
      if (failedOutcomes.has(text(dims.outcome) ?? '')) totals.slice.failedRequests += value;
    }

    if (document.type == 'cost') {
      let unit = text(data.unit);
      let amount = parseAmount(value);

      if (unit && amount !== undefined) {
        addCost(totals.costs, {
          unit: costUnit(unit),
          basis: document.ingest.credentialKind == 'source' ? 'billed' : 'client_estimate',
          amount
        });
      }
    }
  }

  for (let totals of slices.values()) {
    let offering = totals.slice.modelId
      ? d.catalog?.resolveModel({
          raw: totals.slice.modelRaw ?? totals.slice.modelId,
          provider: totals.slice.provider,
          family: totals.slice.client?.family,
          at: totals.slice.bucket
        }).offering
      : undefined;

    let usd = offering
      ? computeRequestCost({ offering, tokens: totals.slice.tokens, contextTokens: 0 })
      : undefined;
    if (usd !== undefined) totals.computed = parseAmount(usd);
  }

  return [...slices.values()].map(totals => {
    let entry = { costs: [...totals.costs.values()], computed: totals.computed };
    let preferred = preferredAmount(entry, selectCostBasis([entry]));

    return {
      ...totals.slice,
      costReported: reportedCosts(totals.costs),
      ...(totals.computed !== undefined
        ? { costComputedUsd: toDecimal(totals.computed) }
        : {}),
      ...(preferred !== undefined ? { costUsd: toDecimal(preferred) } : {})
    };
  });
};

let sessionlessProjection = {
  _id: 1,
  type: 1,
  occurredAt: 1,
  source: 1,
  ingest: 1,
  client: 1,
  data: 1,
  attribution: 1
} as const;

let loadSessionlessRecords = async (d: {
  organizationId: string;
  instanceId: string;
  bucket: Date;
}): Promise<SessionlessRecord[]> => {
  let from = d.bucket;
  let to = new Date(d.bucket.getTime() + scanWindowMs);

  let memorySink = getRuntime().memorySink;
  if (memorySink) {
    return memorySink.list({ organizationId: d.organizationId }).flatMap(({ record }) => {
      let at = new Date(record.occurred_at);
      if (record.ingest.instance_id != d.instanceId || record.ctx.session_key) return [];
      if (at < from || at >= to) return [];

      let mapped = toRecordDocument(record, { storage: defaultStoragePolicy, now: epoch });
      return mapped ? [{ ...mapped.document, kind: record.kind }] : [];
    });
  }

  let store = getStore();
  await store.ready();
  let { events, measurements } = store.collections();

  let filter = {
    organizationId: d.organizationId,
    instanceId: d.instanceId,
    occurredAt: { $gte: from, $lt: to },
    'client.family': { $in: [...aggregateUsageFamilies] },
    'ctx.sessionKey': { $exists: false }
  };

  type Projected = Omit<SessionlessRecord, 'kind'>;

  let [fromMeasurements, fromEvents] = await Promise.all([
    measurements.find<Projected>(filter, { projection: sessionlessProjection }).toArray(),
    events
      .find<Projected>(
        { ...filter, 'source.role': 'aggregate' },
        { projection: sessionlessProjection }
      )
      .toArray()
  ]);

  return [
    ...fromMeasurements.map(document => ({ ...document, kind: 'measurement' as const })),
    ...fromEvents.map(document => ({ ...document, kind: 'event' as const }))
  ];
};

export let settleSessionless = async (d: {
  organizationId: string;
  instanceId: string;
  bucket: Date;
}) => {
  let records = await loadSessionlessRecords(d);
  let slices = sessionlessBaseSlices({
    records,
    bucket: d.bucket,
    catalog: await getCatalog()
  });

  await writeSessionFacts({ sessionKey: sessionlessKey(d.instanceId, d.bucket), slices });
};
