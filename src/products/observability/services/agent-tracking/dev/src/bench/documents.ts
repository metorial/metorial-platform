import {
  addTokens,
  emptyTokens,
  parseAmount,
  toDecimal,
  type Decimal,
  type Tokens
} from '@mtsrc/agent-tracking-cost';
import {
  ATTRIBUTION_VERSION,
  bucketStart,
  FACTS_VERSION,
  SUMMARY_VERSION
} from '@mtsrc/agent-tracking-layers';
import { defaultRetentionDays } from '@mtsrc/agent-tracking-module-scope';
import { buildSessionSlices, type BaseSlice } from '@mtsrc/agent-tracking-module-usage';
import { versionKey, type BillingMode } from '@mtsrc/agent-tracking-spec';
import type {
  AttributionEntry,
  RecordDocument,
  SessionDocument,
  SessionModelSummary,
  UsageSliceDocument
} from '@mtsrc/agent-tracking-store';
import { dayMs } from '../lib/clock';
import { createSampler, seedOf, stableHex, type Sampler } from '../lib/random';
import { costOf } from '../load/synth';
import type { SeedShape } from './shape';

let bucketMs = 15 * 60_000;

let { recordRetentionDays, usageRetentionDays } = defaultRetentionDays;

let calibrationSessions = 4_000;

let clientVersions = ['2.1.314', '2.1.320', '2.1.326'];

export type OrgContext = {
  index: number;
  organizationId: string;
  projectId: string;
  instanceIds: string[];
  userIds: string[];
  anchor: Date;
};

type SlicePlan = {
  bucket: Date;
  modelIndex: number;
  sessionsStarted: 0 | 1;
  requests: number;
  failedRequests: number;
  toolCalls: number;
  turns: number;
  tokens: Tokens;
  costUsd: number;
};

export type SessionPlan = {
  key: string;
  day: number;
  userIndex: number;
  instanceIndex: number;
  clientVersion: string;
  billingMode: BillingMode;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date;
  slices: SlicePlan[];
};

export type EventTemplates = Record<SeedShape['eventMix'][number]['type'], RecordDocument>;

let startOfUtcDay = (at: Date) =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

export let dayStartOf = (anchor: Date, shape: Pick<SeedShape, 'days'>, day: number) =>
  new Date(startOfUtcDay(anchor).getTime() - (shape.days - 1 - day) * dayMs);

let dayWeight = (shape: SeedShape, start: Date) => {
  let weekday = start.getUTCDay();

  return weekday == 0 || weekday == 6 ? shape.weekendShare : 1;
};

let decimalOf = (usd: number): Decimal => toDecimal(parseAmount(usd.toFixed(9))!);

let planSlices = (d: {
  shape: SeedShape;
  sampler: Sampler;
  startedAt: Date;
  primary: number;
  secondary: number | null;
}): SlicePlan[] => {
  let { shape, sampler } = d;
  let buckets = Math.max(1, sampler.count(shape.bucketsPerSession));
  let first = bucketStart(d.startedAt, 15).getTime();
  let slices: SlicePlan[] = [];

  let slice = (bucket: Date, modelIndex: number, isFirst: boolean): SlicePlan => {
    let model = shape.models[modelIndex]!;
    let requests = Math.max(1, sampler.count(shape.requestsPerSlice));
    let tokens: Tokens = {
      inputUncached: requests * sampler.count({ median: 40, p90: 2_000, max: 200_000 }),
      cacheRead: requests * sampler.count({ median: 30_000, p90: 120_000, max: 1_000_000 }),
      cacheWrite: requests * sampler.count({ median: 1_500, p90: 12_000, max: 200_000 }),
      output: requests * sampler.count({ median: 350, p90: 2_500, max: 64_000 }),
      reasoning: 0
    };

    return {
      bucket,
      modelIndex,
      sessionsStarted: isFirst ? 1 : 0,
      requests,
      failedRequests: sampler.bool(0.05) ? 1 : 0,
      toolCalls: Math.round(requests * sampler.next() * 1.6),
      turns: isFirst ? Math.max(1, Math.round(requests / 4)) : Math.round(requests / 6),
      tokens,
      costUsd: costOf(model, tokens)
    };
  };

  for (let index = 0; index < buckets; index++) {
    let bucket = new Date(first + index * bucketMs);

    slices.push(slice(bucket, d.primary, index == 0));
    if (d.secondary !== null && sampler.bool(0.5))
      slices.push(slice(bucket, d.secondary, false));
  }

  return slices;
};

let planOne = (d: {
  shape: SeedShape;
  seed: number;
  org: Pick<OrgContext, 'index' | 'instanceIds' | 'userIds'>;
  day: number;
  index: number;
  dayStart: Date;
}): SessionPlan => {
  let { shape } = d;
  let sampler = createSampler(seedOf(d.seed, d.org.index, d.day, d.index));
  let modelWeights = shape.models.map((model, index) => ({
    value: index,
    weight: model.weight
  }));

  let userIndex = sampler.int(d.org.userIds.length);
  let instanceIndex = userIndex % d.org.instanceIds.length;
  let startedAt = new Date(d.dayStart.getTime() + (8 + sampler.next() * 11) * 3_600_000);
  let primary = sampler.weighted(modelWeights);
  let secondary =
    shape.models.length > 1 && sampler.bool(shape.secondModelShare)
      ? (primary + 1 + sampler.int(shape.models.length - 1)) % shape.models.length
      : null;

  let slices = planSlices({ shape, sampler, startedAt, primary, secondary });
  let lastBucket = slices[slices.length - 1]!.bucket.getTime();
  let lastActivityAt = new Date(
    Math.max(startedAt.getTime() + 1_000, lastBucket + Math.floor(sampler.next() * bucketMs))
  );

  return {
    key: stableHex(32, d.seed, d.org.index, d.day, d.index),
    day: d.day,
    userIndex,
    instanceIndex,
    clientVersion: clientVersions[userIndex % clientVersions.length]!,
    billingMode: userIndex % 10 < 3 ? 'included' : 'api',
    startedAt,
    lastActivityAt,
    endedAt: new Date(lastActivityAt.getTime() + 60_000),
    slices
  };
};

export let meanSlicesPerSession = (shape: SeedShape) => {
  let org = { index: -1, instanceIds: ['calibration'], userIds: ['calibration'] };
  let total = 0;

  for (let index = 0; index < calibrationSessions; index++) {
    total += planOne({
      shape,
      seed: 0,
      org,
      day: 0,
      index,
      dayStart: new Date(0)
    }).slices.length;
  }

  return total / calibrationSessions;
};

export type DayPlanner = {
  sessionsPerOrganization: number;
  meanSlicesPerSession: number;
  planDay: (org: OrgContext, day: number) => SessionPlan[];
  eventsPerSession: (org: OrgContext) => number;
};

// Sessions per day follow the working week (07 §8.1 counts working days), scaled so the year
// lands on the target slice count.
export let createDayPlanner = (shape: SeedShape, seed: number): DayPlanner => {
  let mean = meanSlicesPerSession(shape);
  let sessionsPerOrganization = shape.slicesPerOrganization / mean;
  let weightCache = new Map<number, number>();

  let totalWeight = (anchor: Date) => {
    let key = startOfUtcDay(anchor).getTime();
    let cached = weightCache.get(key);
    if (cached !== undefined) return cached;

    let sum = 0;
    for (let day = 0; day < shape.days; day++)
      sum += dayWeight(shape, dayStartOf(anchor, shape, day));

    weightCache.set(key, sum);
    return sum;
  };

  let sessionsOn = (org: OrgContext, day: number) => {
    let start = dayStartOf(org.anchor, shape, day);
    let expected =
      (sessionsPerOrganization * dayWeight(shape, start)) / totalWeight(org.anchor);
    let sampler = createSampler(seedOf(seed, org.index, day, 'count'));
    let whole = Math.floor(expected);

    return whole + (sampler.bool(expected - whole) ? 1 : 0);
  };

  let eventWindowSessions = (org: OrgContext) => {
    let sum = 0;
    for (let day = shape.days - shape.eventDays; day < shape.days; day++) {
      let start = dayStartOf(org.anchor, shape, day);
      sum += (sessionsPerOrganization * dayWeight(shape, start)) / totalWeight(org.anchor);
    }

    return sum;
  };

  return {
    sessionsPerOrganization,
    meanSlicesPerSession: mean,

    planDay: (org, day) => {
      let dayStart = dayStartOf(org.anchor, shape, day);
      let count = sessionsOn(org, day);
      let plans: SessionPlan[] = [];

      for (let index = 0; index < count; index++) {
        let plan = planOne({ shape, seed, org, day, index, dayStart });
        if (plan.endedAt.getTime() <= org.anchor.getTime()) plans.push(plan);
      }

      return plans;
    },

    eventsPerSession: org =>
      shape.eventDays > 0
        ? shape.eventsPerOrganization / Math.max(1, eventWindowSessions(org))
        : 0
  };
};

let attributionOf = (org: OrgContext, plan: SessionPlan) => {
  let userId = org.userIds[plan.userIndex]!;
  let entries: AttributionEntry[] = [
    { kind: 'user', entityId: userId, source: 'credential', weight: 1 }
  ];

  return {
    entries,
    dimIds: [userId, org.projectId, org.instanceIds[plan.instanceIndex]!],
    version: ATTRIBUTION_VERSION
  };
};

let baseSliceOf = (shape: SeedShape, plan: SessionPlan, slice: SlicePlan): BaseSlice => {
  let cost = decimalOf(slice.costUsd);

  return {
    bucket: slice.bucket,
    bucketMinutes: 15,
    modelId: shape.models[slice.modelIndex]!.id,
    modelRaw: shape.models[slice.modelIndex]!.id,
    provider: 'anthropic',
    vendorId: 'anthropic',
    vendorSource: 'first-party',
    billingMode: plan.billingMode,
    billingSource: 'client',
    sessionsStarted: slice.sessionsStarted,
    turns: slice.turns,
    requests: slice.requests,
    failedRequests: slice.failedRequests,
    toolCalls: slice.toolCalls,
    tokens: slice.tokens,
    costReported: [{ unit: 'usd', basis: 'client_estimate', amount: cost }],
    costComputedUsd: cost,
    costUsd: cost,
    lines: { added: 0, removed: 0 }
  };
};

let summaryOf = (shape: SeedShape, plan: SessionPlan) => {
  let byModel = new Map<number, { requests: number; tokens: Tokens; cost: number }>();
  let tokens = emptyTokens();
  let cost = 0;
  let requests = 0;
  let failedRequests = 0;
  let toolCalls = 0;
  let turns = 0;

  for (let slice of plan.slices) {
    let entry = byModel.get(slice.modelIndex) ?? {
      requests: 0,
      tokens: emptyTokens(),
      cost: 0
    };

    entry.requests += slice.requests;
    entry.cost += slice.costUsd;
    addTokens(entry.tokens, slice.tokens);
    byModel.set(slice.modelIndex, entry);

    addTokens(tokens, slice.tokens);
    cost += slice.costUsd;
    requests += slice.requests;
    failedRequests += slice.failedRequests;
    toolCalls += slice.toolCalls;
    turns += slice.turns;
  }

  let models: SessionModelSummary[] = [...byModel.entries()].map(([modelIndex, entry]) => ({
    modelId: shape.models[modelIndex]!.id,
    rawIds: [shape.models[modelIndex]!.id],
    vendorId: 'anthropic',
    vendorSource: 'first-party',
    billingMode: plan.billingMode,
    billingSource: 'client',
    requests: entry.requests,
    tokens: entry.tokens,
    costReported: [{ unit: 'usd', basis: 'client_estimate', amount: decimalOf(entry.cost) }],
    costComputedUsd: decimalOf(entry.cost)
  }));

  return {
    durationMs: plan.lastActivityAt.getTime() - plan.startedAt.getTime(),
    turns,
    prompts: turns,
    requests,
    failedRequests,
    retries: 0,
    toolCalls,
    toolCallsByClass: {
      file_read: Math.round(toolCalls * 0.5),
      shell: toolCalls - Math.round(toolCalls * 0.5)
    },
    mcpServers: [],
    subagents: [],
    models,
    tokens,
    costReported: [{ unit: 'usd', basis: 'client_estimate', amount: decimalOf(cost) }],
    costComputedUsd: decimalOf(cost),
    costUsd: decimalOf(cost),
    lines: { added: 0, removed: 0 },
    commits: 0,
    pullRequests: 0,
    errorsByClass: (failedRequests ? { server: failedRequests } : {}) as Record<
      string,
      number
    >,
    compactions: 0
  };
};

export let buildSessionDocuments = (d: {
  shape: SeedShape;
  org: OrgContext;
  plan: SessionPlan;
  now: Date;
}): { session: SessionDocument; slices: UsageSliceDocument[] } => {
  let { shape, org, plan } = d;
  let attribution = attributionOf(org, plan);
  let expiresAt = new Date(plan.startedAt.getTime() + usageRetentionDays * dayMs);
  let recordsExpired =
    plan.lastActivityAt.getTime() + recordRetentionDays * dayMs <= d.now.getTime();

  let session: SessionDocument = {
    _id: plan.key,
    organizationId: org.organizationId,
    projectId: org.projectId,
    instanceId: org.instanceIds[plan.instanceIndex]!,
    origin: 'native',
    versions: {
      summary: SUMMARY_VERSION,
      attribution: ATTRIBUTION_VERSION,
      facts: FACTS_VERSION
    },
    client: {
      family: 'claude-code',
      surface: 'cli',
      version: plan.clientVersion,
      versionKey: versionKey(plan.clientVersion)
    },
    rootSessionKey: plan.key,
    startedAt: plan.startedAt,
    lastActivityAt: plan.lastActivityAt,
    lastObservedAt: plan.lastActivityAt,
    endedAt: plan.endedAt,
    state: 'ended',
    observed: {
      userId: attribution.entries[0]!.entityId,
      clientUserIds: [],
      clientInstallationIds: []
    },
    context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false },
    attribution: {
      ...attribution,
      inputsHash: stableHex(32, 'bench-attribution', attribution.dimIds.join(',')),
      computedAt: plan.endedAt
    },
    summary: summaryOf(shape, plan),
    summaryWatermark: plan.lastActivityAt,
    factsComputedAt: plan.endedAt,
    settledObservedAt: plan.lastActivityAt,
    coverage: {
      hasUsage: true,
      hasContext: false,
      hasRepo: false,
      fullyAttributed: true,
      usageSource: 'otel.logs'
    },
    ...(recordsExpired ? { frozen: true as const } : {}),
    expiresAt
  };

  let slices = buildSessionSlices({
    session,
    attribution,
    slices: plan.slices.map(slice => baseSliceOf(shape, plan, slice)),
    now: plan.endedAt
  });

  return { session, slices };
};

export let buildEventDocuments = (d: {
  shape: SeedShape;
  org: OrgContext;
  plan: SessionPlan;
  count: number;
  templates: EventTemplates;
  seed: number;
}): RecordDocument[] => {
  let { shape, org, plan } = d;
  let sampler = createSampler(seedOf(d.seed, 'events', org.index, plan.key));
  let mix = shape.eventMix.map(entry => ({ value: entry.type, weight: entry.weight }));
  let span = Math.max(1_000, plan.lastActivityAt.getTime() - plan.startedAt.getTime());
  let userId = org.userIds[plan.userIndex]!;
  let instanceId = org.instanceIds[plan.instanceIndex]!;
  let documents: RecordDocument[] = [];

  for (let index = 0; index < d.count; index++) {
    let type = sampler.weighted(mix);
    let template = d.templates[type];
    let occurredAt = new Date(plan.startedAt.getTime() + Math.floor(sampler.next() * span));
    let slice = plan.slices[sampler.int(plan.slices.length)]!;
    let model = shape.models[slice.modelIndex]!;
    let id = stableHex(32, 'event', org.organizationId, plan.key, index);

    let data: Record<string, unknown> = { ...template.data };

    if (type == 'model.request') {
      let requests = Math.max(1, slice.requests);
      let tokens = {
        inputUncached: Math.round(slice.tokens.inputUncached / requests),
        cacheRead: Math.round(slice.tokens.cacheRead / requests),
        cacheWrite: Math.round(slice.tokens.cacheWrite / requests),
        output: Math.round(slice.tokens.output / requests)
      };
      let failed = sampler.bool(0.02);

      let { usage: _usage, cost: _cost, ...rest } = data;

      data = failed
        ? { ...rest, outcome: 'error', error: { class: 'server' }, model: { id: model.id } }
        : {
            ...data,
            model: { id: model.id },
            usage: { provenance: 'exact', ...tokens },
            cost: {
              amount: decimalOf(costOf(model, tokens)),
              unit: 'usd',
              basis: 'client_estimate'
            },
            durationMs: sampler.count({ median: 4_500, p90: 18_000, min: 200, max: 300_000 })
          };
    }

    documents.push({
      ...template,
      _id: id,
      organizationId: org.organizationId,
      projectId: org.projectId,
      instanceId,
      occurredAt,
      observedAt: new Date(occurredAt.getTime() + 2_000),
      expiresAt: new Date(occurredAt.getTime() + recordRetentionDays * dayMs),
      ingest: { ...template.ingest, requestId: stableHex(32, 'request', id) },
      source: {
        ...template.source,
        ...(template.source.factKey ? { factKey: `bench:${plan.key}:${index}` } : {})
      },
      client: {
        ...template.client,
        version: plan.clientVersion,
        versionKey: versionKey(plan.clientVersion)
      },
      attribution: { userId },
      ctx: {
        ...template.ctx,
        sessionId: plan.key,
        sessionKey: plan.key,
        sessionOrigin: 'native'
      },
      data
    });
  }

  return documents;
};
