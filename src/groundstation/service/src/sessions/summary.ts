import { computeRequestCost, type CatalogIndex, type RequestTokens } from '../catalog';
import type { BaseSlice } from '../facts/write';
import type {
  ReportedCost,
  SessionCoverage,
  SessionModelSummary,
  SessionSummary,
  SourceKind,
  Tokens
} from '../store/derivedModels';
import type { RecordDocument } from '../store/models';
import { bucketStart } from './buckets';
import { parseAmount, toDecimal, type Amount } from './decimal';
import { documentCorrelations, type Correlation } from './keys';
import { sourceKindOf, usageRank } from './sources';

let preferredBases = ['billed', 'server_estimate', 'client_estimate'] as const;
let centsPerUsd = 100n;

export type SummaryRecord = Pick<
  RecordDocument,
  | '_id'
  | 'type'
  | 'occurredAt'
  | 'observedAt'
  | 'durationMs'
  | 'source'
  | 'ingest'
  | 'client'
  | 'ctx'
  | 'data'
  | 'attribution'
>;

export type SessionAggregate = {
  records: number;
  summary: SessionSummary;
  slices: BaseSlice[];
  coverage: Omit<SessionCoverage, 'fullyAttributed'>;
  correlations: Correlation[];
  firstOccurredAt?: Date;
  lastOccurredAt?: Date;
  lastTurnObservedAt?: Date;
};

export type CostEntry = { unit: string; basis: string; amount: Amount };

type UsageEntry = {
  type: string;
  rank: number;
  source?: SourceKind;
  occurredAt: Date;
  subagentId?: string;
  turnId?: string;
  requestId?: string;
  modelRaw?: string;
  provider?: string;
  tokens?: RequestTokens;
  costs: CostEntry[];
  failed: boolean;
};

type SliceTotals = {
  slice: Omit<BaseSlice, 'lines' | 'costReported' | 'costComputedUsd' | 'costUsd'>;
  costs: Map<string, CostEntry>;
  computed?: Amount;
  preferred?: Amount;
  codeLines: { added: number; removed: number };
  toolLines: { added: number; removed: number };
};

type Grouped = { tokens: Tokens; costs: Map<string, CostEntry>; computed?: Amount };

let record = (value: unknown) =>
  typeof value == 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

let text = (value: unknown) => (typeof value == 'string' && value ? value : undefined);

let count = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export let emptyTokens = (): Tokens => ({
  inputUncached: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0
});

export let addTokens = (target: Tokens, tokens: Tokens) => {
  target.inputUncached += tokens.inputUncached;
  target.cacheRead += tokens.cacheRead;
  target.cacheWrite += tokens.cacheWrite;
  target.output += tokens.output;
  target.reasoning += tokens.reasoning;
};

export let readTokens = (value: unknown): RequestTokens | undefined => {
  let usage = record(value);
  if (!usage) return undefined;

  let cacheWrite5m = count(usage.cacheWrite5m);
  let cacheWrite1h = count(usage.cacheWrite1h);

  let tokens: RequestTokens = {
    inputUncached: count(usage.inputUncached),
    cacheRead: count(usage.cacheRead),
    cacheWrite: count(usage.cacheWrite) || cacheWrite5m + cacheWrite1h,
    output: count(usage.output),
    reasoning: count(usage.reasoning),
    ...(cacheWrite5m ? { cacheWrite5m } : {}),
    ...(cacheWrite1h ? { cacheWrite1h } : {})
  };

  let total =
    tokens.inputUncached +
    tokens.cacheRead +
    tokens.cacheWrite +
    tokens.output +
    tokens.reasoning;

  return total > 0 ? tokens : undefined;
};

export let readCost = (value: unknown): CostEntry | undefined => {
  let cost = record(value);
  if (!cost || cost.repeatsParent === true) return undefined;

  let unit = text(cost.unit);
  let basis = text(cost.basis);
  let amount = parseAmount(cost.amount);

  return unit && basis && amount !== undefined ? { unit, basis, amount } : undefined;
};

export let usdAmount = (cost: CostEntry) =>
  cost.unit == 'usd'
    ? cost.amount
    : cost.unit == 'cents'
      ? cost.amount / centsPerUsd
      : undefined;

export let addCost = (target: Map<string, CostEntry>, cost: CostEntry) => {
  let key = `${cost.unit}\0${cost.basis}`;
  let existing = target.get(key);

  if (existing) existing.amount += cost.amount;
  else target.set(key, { ...cost });
};

export let reportedCosts = (costs: Map<string, CostEntry>): ReportedCost[] =>
  [...costs.values()].map(cost => ({
    unit: cost.unit,
    basis: cost.basis,
    amount: toDecimal(cost.amount)
  }));

let increment = (target: Record<string, number>, key: string) => {
  target[key] = (target[key] ?? 0) + 1;
};

export type CostBasis = (typeof preferredBases)[number] | 'computed';

export let selectCostBasis = (
  entries: { costs: CostEntry[]; computed?: Amount }[]
): CostBasis | undefined => {
  for (let basis of preferredBases) {
    let found = entries.some(entry =>
      entry.costs.some(cost => cost.basis == basis && usdAmount(cost) !== undefined)
    );
    if (found) return basis;
  }

  return entries.some(entry => entry.computed !== undefined) ? 'computed' : undefined;
};

export let preferredAmount = (
  entry: { costs: CostEntry[]; computed?: Amount },
  basis: CostBasis | undefined
): Amount | undefined => {
  if (!basis) return undefined;
  if (basis == 'computed') return entry.computed;

  let total: Amount | undefined;

  for (let cost of entry.costs) {
    let usd = cost.basis == basis ? usdAmount(cost) : undefined;
    if (usd !== undefined) total = (total ?? 0n) + usd;
  }

  return total;
};

export let aggregateSession = async (d: {
  records: AsyncIterable<SummaryRecord> | Iterable<SummaryRecord>;
  family: string;
  catalog: CatalogIndex | null;
  correlationsSince?: Date;
}): Promise<SessionAggregate> => {
  let seen = new Map<string, Set<string>>();
  let isNew = (type: string, key: string) => {
    let keys = seen.get(type);
    if (!keys) seen.set(type, (keys = new Set()));
    if (keys.has(key)) return false;

    keys.add(key);
    return true;
  };

  let records = 0;
  let firstOccurredAt: Date | undefined;
  let lastOccurredAt: Date | undefined;
  let lastEndedAt = 0;
  let lastTurnObservedAt: Date | undefined;
  let firstSubagentId: string | undefined;

  let turns = 0;
  let prompts = 0;
  let retries = 0;
  let toolCalls = 0;
  let toolCallsByClass: Record<string, number> = {};
  let mcpServers = new Set<string>();
  let subagentNames = new Map<string, string>();
  let codeLines = { added: 0, removed: 0 };
  let toolLines = { added: 0, removed: 0 };
  let commits = 0;
  let pullRequests = 0;
  let errorsByClass: Record<string, number> = {};
  let compactions = 0;
  let hasContext = false;
  let hasRepo = false;

  let correlations = new Map<string, Correlation>();
  let usage: UsageEntry[] = [];
  let slices = new Map<string, SliceTotals>();

  let sliceFor = (d: {
    occurredAt: Date;
    modelId?: string;
    modelRaw?: string;
    provider?: string;
    subagentId?: string;
  }) => {
    let bucket = bucketStart(d.occurredAt, 15);
    let modelKey = d.modelId ?? (d.modelRaw ? `raw:${d.modelRaw}` : '');
    let key = `${bucket.toISOString()}|${modelKey}|${d.subagentId ?? ''}`;

    let totals = slices.get(key);

    if (!totals) {
      totals = {
        slice: {
          bucket,
          bucketMinutes: 15,
          ...(d.subagentId ? { subagentId: d.subagentId } : {}),
          ...(d.modelId ? { modelId: d.modelId } : {}),
          ...(d.modelRaw ? { modelRaw: d.modelRaw } : {}),
          ...(d.provider ? { provider: d.provider } : {}),
          sessionsStarted: 0,
          turns: 0,
          requests: 0,
          failedRequests: 0,
          toolCalls: 0,
          tokens: emptyTokens()
        },
        costs: new Map(),
        codeLines: { added: 0, removed: 0 },
        toolLines: { added: 0, removed: 0 }
      };

      slices.set(key, totals);
    }

    return totals;
  };

  for await (let document of d.records) {
    records++;

    let occurredAt = document.occurredAt;
    let data = document.data ?? {};
    let ctx = document.ctx ?? {};
    let subagentId = ctx.agent?.id;

    if (!firstOccurredAt || occurredAt < firstOccurredAt) {
      firstOccurredAt = occurredAt;
      firstSubagentId = subagentId;
    }

    if (!lastOccurredAt || occurredAt > lastOccurredAt) lastOccurredAt = occurredAt;

    lastEndedAt = Math.max(lastEndedAt, occurredAt.getTime() + (document.durationMs ?? 0));

    if (!d.correlationsSince || document.observedAt > d.correlationsSince) {
      for (let correlation of documentCorrelations(document)) {
        correlations.set(`${correlation.type}:${correlation.value}`, correlation);
      }
    }

    if (document.type == 'session.context') hasContext = true;
    if (document.attribution?.workspaceId) hasContext = true;
    if (document.attribution?.repoId) hasContext = hasRepo = true;

    if (document.source.role != 'primary') continue;

    let dedupeKey = document.source.factKey ?? document._id;
    if (!isNew(document.type, dedupeKey)) continue;

    let error = record(data.error);
    let errorClass = text(error?.class);

    switch (document.type) {
      case 'prompt.submitted':
        prompts++;
        break;

      case 'turn.completed': {
        turns++;
        sliceFor({ occurredAt, subagentId }).slice.turns++;

        if (!lastTurnObservedAt || document.observedAt > lastTurnObservedAt) {
          lastTurnObservedAt = document.observedAt;
        }

        if (errorClass) increment(errorsByClass, errorClass);
        break;
      }

      case 'model.retry':
        retries++;
        break;

      case 'tool.call': {
        let tool = record(data.tool);
        let lines = record(data.lines);

        toolCalls++;
        increment(toolCallsByClass, text(tool?.class) ?? 'other');

        let server = text(record(tool?.mcp)?.server);
        if (server) mcpServers.add(server);

        if (errorClass) increment(errorsByClass, errorClass);

        let totals = sliceFor({ occurredAt, subagentId });
        totals.slice.toolCalls++;

        if (lines) {
          toolLines.added += count(lines.added);
          toolLines.removed += count(lines.removed);
          totals.toolLines.added += count(lines.added);
          totals.toolLines.removed += count(lines.removed);
        }

        break;
      }

      case 'code.change': {
        let lines = record(data.lines);
        if (!lines) break;

        let totals = sliceFor({ occurredAt, subagentId });

        codeLines.added += count(lines.added);
        codeLines.removed += count(lines.removed);
        totals.codeLines.added += count(lines.added);
        totals.codeLines.removed += count(lines.removed);
        break;
      }

      case 'agent.start':
      case 'agent.end': {
        let name = text(data.name) ?? text(data.type);
        if (subagentId && name && !subagentNames.has(subagentId)) {
          subagentNames.set(subagentId, name);
        }

        break;
      }

      case 'vcs.commit':
        commits++;
        break;

      case 'vcs.pull_request':
        if (!data.kind || data.kind == 'opened') pullRequests++;
        break;

      case 'context.compaction':
        compactions++;
        break;

      case 'client.error':
        increment(errorsByClass, errorClass ?? 'unknown');
        break;
    }

    if (
      document.type != 'model.request' &&
      document.type != 'usage.charge' &&
      document.type != 'turn.completed'
    ) {
      continue;
    }

    let tokens = readTokens(data.usage);
    let cost = readCost(data.cost);
    let model = record(data.model);
    let target = record(data.for);

    if (document.type == 'turn.completed' && !tokens && !cost) continue;

    let source = sourceKindOf({
      channel: document.source.channel,
      credentialKind: document.ingest.credentialKind,
      type: document.type,
      data
    });

    if (document.type == 'model.request' && data.outcome && data.outcome != 'ok') {
      increment(errorsByClass, errorClass ?? 'unknown');
    }

    usage.push({
      type: document.type,
      rank: usageRank(d.family, source),
      source,
      occurredAt,
      subagentId,
      turnId: text(target?.turnId) ?? ctx.turnId,
      requestId: text(target?.requestId) ?? ctx.requestId,
      modelRaw: text(model?.id),
      provider: text(model?.provider),
      tokens,
      costs: cost ? [cost] : [],
      failed: document.type == 'model.request' && !!data.outcome && data.outcome != 'ok'
    });
  }

  let usageBearing = usage.filter(entry => entry.tokens || entry.costs.length);
  let winnerRank = Math.min(...usageBearing.map(entry => entry.rank));
  let winner = usageBearing.find(entry => entry.rank == winnerRank)?.source;

  let requestEntries = usage.filter(entry => entry.type == 'model.request');
  let winnerHasRequests = requestEntries.some(entry => entry.rank == winnerRank);

  let modelByCorrelation = new Map<string, UsageEntry>();

  for (let entry of requestEntries) {
    if (!entry.modelRaw) continue;

    if (entry.turnId) modelByCorrelation.set(`turn:${entry.turnId}`, entry);
    if (entry.requestId) modelByCorrelation.set(`request:${entry.requestId}`, entry);
  }

  let resolved = new Map<string, ReturnType<CatalogIndex['resolveModel']>>();

  let resolve = (raw: string | undefined, provider: string | undefined, at: Date) => {
    if (!raw || !d.catalog) return {};

    let key = `${raw}\0${provider ?? ''}\0${at.toISOString().slice(0, 13)}`;
    let cached = resolved.get(key);
    if (cached) return cached;

    let result = d.catalog.resolveModel({ raw, provider, family: d.family, at });
    resolved.set(key, result);

    return result;
  };

  let counted = usage
    .filter(entry =>
      entry.type == 'model.request'
        ? !winnerHasRequests || entry.rank == winnerRank
        : entry.rank == winnerRank
    )
    .map(entry => {
      let modelSource =
        entry.modelRaw || entry.type == 'model.request'
          ? entry
          : (modelByCorrelation.get(`request:${entry.requestId}`) ??
            modelByCorrelation.get(`turn:${entry.turnId}`) ??
            entry);

      let modelRaw = modelSource.modelRaw;
      let provider = modelSource.provider;
      let { modelId, offering } = resolve(modelRaw, provider, entry.occurredAt);

      let countsUsage = entry.rank == winnerRank;
      let tokens = countsUsage ? entry.tokens : undefined;
      let costs = countsUsage ? entry.costs : [];

      let computedNumber =
        offering && tokens
          ? computeRequestCost({
              offering,
              tokens,
              contextTokens: tokens.inputUncached + tokens.cacheRead + tokens.cacheWrite
            })
          : undefined;

      return {
        entry,
        modelId,
        modelRaw,
        provider,
        tokens,
        costs,
        computed: computedNumber === undefined ? undefined : parseAmount(computedNumber)
      };
    });

  let basis = selectCostBasis(counted);

  let totals: Grouped = { tokens: emptyTokens(), costs: new Map() };
  let models = new Map<
    string,
    Grouped & { summary: SessionModelSummary; rawIds: Set<string> }
  >();
  let subagents = new Map<string, { requests: number; costUsd?: Amount }>();
  let costUsd: Amount | undefined;
  let requests = 0;
  let failedRequests = 0;

  for (let item of counted) {
    let isRequest = item.entry.type == 'model.request';
    let preferred = preferredAmount(item, basis);

    if (isRequest) {
      requests++;
      if (item.entry.failed) failedRequests++;
    }

    if (item.tokens) addTokens(totals.tokens, item.tokens);
    for (let cost of item.costs) addCost(totals.costs, cost);
    if (item.computed !== undefined) totals.computed = (totals.computed ?? 0n) + item.computed;
    if (preferred !== undefined) costUsd = (costUsd ?? 0n) + preferred;

    let modelKey = item.modelId ?? (item.modelRaw ? `raw:${item.modelRaw}` : undefined);

    if (modelKey) {
      let model = models.get(modelKey);

      if (!model) {
        model = {
          tokens: emptyTokens(),
          costs: new Map(),
          rawIds: new Set(),
          summary: {
            ...(item.modelId ? { modelId: item.modelId } : {}),
            rawIds: [],
            requests: 0,
            tokens: emptyTokens(),
            costReported: []
          }
        };

        models.set(modelKey, model);
      }

      if (item.modelRaw) model.rawIds.add(item.modelRaw);
      if (isRequest) model.summary.requests++;
      if (item.tokens) addTokens(model.tokens, item.tokens);
      for (let cost of item.costs) addCost(model.costs, cost);
      if (item.computed !== undefined) model.computed = (model.computed ?? 0n) + item.computed;
    }

    if (item.entry.subagentId) {
      let subagent = subagents.get(item.entry.subagentId) ?? { requests: 0 };

      if (isRequest) subagent.requests++;
      if (preferred !== undefined) subagent.costUsd = (subagent.costUsd ?? 0n) + preferred;

      subagents.set(item.entry.subagentId, subagent);
    }

    let slice = sliceFor({
      occurredAt: item.entry.occurredAt,
      modelId: item.modelId,
      modelRaw: item.modelRaw,
      provider: item.provider,
      subagentId: item.entry.subagentId
    });

    if (isRequest) {
      slice.slice.requests++;
      if (item.entry.failed) slice.slice.failedRequests++;
    }

    if (item.tokens) addTokens(slice.slice.tokens, item.tokens);
    for (let cost of item.costs) addCost(slice.costs, cost);
    if (item.computed !== undefined) slice.computed = (slice.computed ?? 0n) + item.computed;
    if (preferred !== undefined) slice.preferred = (slice.preferred ?? 0n) + preferred;
  }

  let useCodeLines = codeLines.added + codeLines.removed > 0;

  if (firstOccurredAt) {
    sliceFor({
      occurredAt: firstOccurredAt,
      subagentId: firstSubagentId
    }).slice.sessionsStarted = 1;
  }

  let subagentIds = new Set([...subagentNames.keys(), ...subagents.keys()]);

  let summary: SessionSummary = {
    durationMs: firstOccurredAt ? Math.max(0, lastEndedAt - firstOccurredAt.getTime()) : 0,
    turns,
    prompts,
    requests,
    failedRequests,
    retries,
    toolCalls,
    toolCallsByClass,
    mcpServers: [...mcpServers].sort(),
    subagents: [...subagentIds].map(agentId => {
      let subagent = subagents.get(agentId);

      return {
        agentId,
        name: subagentNames.get(agentId) ?? agentId,
        requests: subagent?.requests ?? 0,
        ...(subagent?.costUsd !== undefined ? { costUsd: toDecimal(subagent.costUsd) } : {})
      };
    }),
    models: [...models.values()].map(model => ({
      ...model.summary,
      rawIds: [...model.rawIds].sort(),
      tokens: model.tokens,
      costReported: reportedCosts(model.costs),
      ...(model.computed !== undefined ? { costComputedUsd: toDecimal(model.computed) } : {})
    })),
    tokens: totals.tokens,
    costReported: reportedCosts(totals.costs),
    ...(totals.computed !== undefined ? { costComputedUsd: toDecimal(totals.computed) } : {}),
    ...(costUsd !== undefined ? { costUsd: toDecimal(costUsd) } : {}),
    lines: useCodeLines ? codeLines : toolLines,
    commits,
    pullRequests,
    errorsByClass,
    compactions
  };

  return {
    records,
    summary,
    slices: [...slices.values()].map(totals => ({
      ...totals.slice,
      costReported: reportedCosts(totals.costs),
      ...(totals.computed !== undefined
        ? { costComputedUsd: toDecimal(totals.computed) }
        : {}),
      ...(totals.preferred !== undefined ? { costUsd: toDecimal(totals.preferred) } : {}),
      lines: useCodeLines ? totals.codeLines : totals.toolLines
    })),
    coverage: {
      hasUsage: usageBearing.length > 0,
      hasContext,
      hasRepo,
      ...(winner ? { usageSource: winner } : {})
    },
    correlations: [...correlations.values()],
    firstOccurredAt,
    lastOccurredAt,
    lastTurnObservedAt
  };
};
