import { knowledgeCacheService } from '@mtsrc/agent-tracking-module-knowledge';
import {
  versionKey,
  type NormalizedRecord,
  type RecordKind
} from '@mtsrc/agent-tracking-spec';
import {
  createDeclarationLookup,
  declaredBilling,
  defaultBillingOf,
  isSubscriptionBilling,
  reportedBilling,
  type Billing,
  type DeclarationLookup
} from '@mtsrc/agent-tracking-module-pricing';
import {
  computeRequestCost,
  type CatalogIndex,
  type ModelRequest
} from '@mtsrc/agent-tracking-model-resolver';
import { sessionlessKey } from '@mtsrc/agent-tracking-module-usage';
import { usageSliceService, type BaseSlice } from '@mtsrc/agent-tracking-module-usage';
import { db } from '@mtsrc/agent-tracking-db';
import { organizationPricingService } from '@mtsrc/agent-tracking-module-pricing';
import {
  createOverridePricer,
  type OverridePricer
} from '@mtsrc/agent-tracking-module-pricing';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { getStore } from '@mtsrc/agent-tracking-store';
import { recordReadbackService, toRecordDocument } from '@mtsrc/agent-tracking-module-records';
import type { RecordDocument } from '@mtsrc/agent-tracking-store';
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
import { type BucketMinutes, bucketStart } from '@mtsrc/agent-tracking-layers';
import { type Amount, parseAmount, toDecimal } from '@mtsrc/agent-tracking-cost';

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
  slice: Omit<BaseSlice, 'costReported' | 'costComputedUsd' | 'costContractUsd' | 'costUsd'>;
  request?: ModelRequest;
  costs: Map<string, CostEntry>;
  computed?: Amount;
  contract?: Amount;
};

// Aggregates name the plan tier when the usage is a subscription's (Kiro).
let billingOf = (d: {
  document: SessionlessRecord;
  agentId?: string;
  declarations?: DeclarationLookup | null;
}): Billing => {
  let data = d.document.data ?? {};
  let tier = text(record(data.dims)?.subscription_tier);
  if (tier) return { mode: 'included', source: 'reported', plan: tier };

  let reported = reportedBilling({
    billing: data.billing,
    authMode: d.document.client.authMode
  });
  if (reported.mode != 'unknown') return reported;

  let declared = declaredBilling(
    d.declarations?.({
      at: d.document.occurredAt,
      userId: d.document.attribution?.userId,
      agentId: d.agentId
    })
  );

  return declared ?? defaultBillingOf(d.document.client.family) ?? reported;
};

let requestOf = (document: SessionlessRecord, billing: Billing): ModelRequest | undefined => {
  let data = document.data ?? {};
  let dims = record(data.dims) ?? {};
  let model = record(data.model);

  let raw = text(dims.model) ?? text(model?.id);
  if (!raw) return undefined;

  return {
    raw,
    provider: text(dims.provider) ?? text(model?.provider),
    family: document.client.family,
    baseUrl: text(model?.baseUrl),
    subscription: isSubscriptionBilling(billing)
  };
};

export let sessionlessBaseSlices = async (d: {
  records: Iterable<SessionlessRecord>;
  bucket: Date;
  catalog: CatalogIndex | null;
  pricing?: OverridePricer | null;
  declarations?: DeclarationLookup | null;
}): Promise<BaseSlice[]> => {
  let records = [...d.records];
  let slices = new Map<string, SliceTotals>();

  let billings = new Map(
    records.map(document => [
      document,
      billingOf({
        document,
        agentId: d.catalog?.vendors.agent(document.client.family)?.id,
        declarations: d.declarations
      })
    ])
  );

  let requests = records.flatMap(
    document => requestOf(document, billings.get(document)!) ?? []
  );
  let resolver = d.catalog ? await d.catalog.prepare(requests) : null;

  for (let document of records) {
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
    let billing = billings.get(document)!;
    let request = requestOf(document, billing);
    let modelRaw = request?.raw;
    let provider = request?.provider;
    let { modelId, vendorId, vendorSource } =
      request && resolver
        ? resolver.resolveModel({ ...request, at: document.occurredAt })
        : {};

    let attribution = document.attribution ?? {};
    let key = [
      placed.bucketMinutes,
      attribution.userId,
      attribution.deviceId,
      attribution.agentId,
      modelId ?? (modelRaw ? `raw:${modelRaw}` : ''),
      vendorId,
      vendorSource,
      billing.mode,
      billing.source,
      billing.plan
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
          ...(vendorId ? { vendorId } : {}),
          ...(vendorSource ? { vendorSource } : {}),
          billingMode: billing.mode,
          ...(billing.source ? { billingSource: billing.source } : {}),
          ...(billing.plan ? { billingPlan: billing.plan } : {}),
          ...(attribution.userId ? { userId: attribution.userId } : {}),
          ...(attribution.deviceId ? { deviceId: attribution.deviceId } : {}),
          ...(attribution.agentId ? { agentId: attribution.agentId } : {}),
          client: {
            family: document.client.family,
            ...(document.client.version
              ? {
                  version: document.client.version,
                  versionKey: versionKey(document.client.version)
                }
              : {}),
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
        ...(modelId ? { request } : {}),
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
    let resolution =
      totals.request && resolver
        ? resolver.resolveModel({ ...totals.request, at: totals.slice.bucket })
        : undefined;

    let usd = resolution?.period
      ? computeRequestCost({
          pricing: resolution.period.pricing,
          tokens: totals.slice.tokens,
          contextTokens: 0
        })
      : undefined;
    if (usd !== undefined) totals.computed = parseAmount(usd);

    let contract =
      resolution && d.pricing
        ? d.pricing({
            at: totals.slice.bucket,
            resolution,
            billingMode: totals.slice.billingMode ?? 'unknown',
            list: totals.computed,
            tokens: totals.slice.tokens,
            contextTokens: 0
          })
        : undefined;
    if (contract) totals.contract = contract.amount;
  }

  return [...slices.values()].map(totals => {
    let entry = {
      costs: [...totals.costs.values()],
      computed: totals.computed,
      contract: totals.contract
    };
    let preferred = preferredAmount(entry, selectCostBasis([entry]));

    return {
      ...totals.slice,
      costReported: reportedCosts(totals.costs),
      ...(totals.computed !== undefined
        ? { costComputedUsd: toDecimal(totals.computed) }
        : {}),
      ...(totals.contract !== undefined
        ? { costContractUsd: toDecimal(totals.contract) }
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

  if (recordReadbackService.isAvailable()) {
    let stored = await recordReadbackService.list({ organizationId: d.organizationId });

    return stored.flatMap(({ record }) => {
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
  let [records, catalog, { overrides, declarations }] = await Promise.all([
    loadSessionlessRecords(d),
    knowledgeCacheService.getKnowledge(),
    organizationPricingService.getOrganizationPricing({ organizationId: d.organizationId })
  ]);

  let instance =
    overrides.length || declarations.length
      ? await db.instance.findUnique({
          where: { id: d.instanceId },
          include: { project: true }
        })
      : null;
  let scope = instance
    ? { organizationId: d.organizationId, projectId: instance.project.id }
    : null;

  let slices = await sessionlessBaseSlices({
    records,
    bucket: d.bucket,
    catalog,
    pricing: scope ? createOverridePricer({ ...scope, overrides, catalog }) : null,
    declarations: scope ? createDeclarationLookup({ ...scope, declarations }) : null
  });

  await usageSliceService.writeSessionSlices({
    sessionKey: sessionlessKey(d.instanceId, d.bucket),
    slices
  });
};
