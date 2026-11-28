import {
  defaultBillingOf,
  isSubscriptionBilling,
  reportedBilling,
  resolveBillings,
  sessionProviderBilling,
  type Billing,
  type DeclarationLookup
} from '@mtsrc/agent-tracking-module-pricing';
import {
  computeRequestCost,
  type CatalogIndex,
  type ModelRequest,
  type RequestTokens,
  type ResolvedModel
} from '@mtsrc/agent-tracking-model-resolver';
import type { BaseSlice } from '@mtsrc/agent-tracking-module-usage';
import type { PricePeriod } from '@mtsrc/agent-tracking-model-resolver';
import type { OverridePricer } from '@mtsrc/agent-tracking-module-pricing';
import type {
  ReportedCost,
  SessionCommitRef,
  SessionCoverage,
  SessionModelSummary,
  SessionPullRequestRef,
  SessionSummary,
  SourceKind
} from '@mtsrc/agent-tracking-store';
import type { RecordDocument } from '@mtsrc/agent-tracking-store';
import { documentCorrelations, movesSessionBounds, type Correlation } from './keys';
import { createSessionToolCallPass, type SessionMcpToolCallRef } from './toolCalls';
import { sourceKindOf, usageRank } from '@mtsrc/agent-tracking-module-usage';
import { bucketStart } from '@mtsrc/agent-tracking-layers';
import {
  desktopContextId,
  isClaudeCodeMainQuerySource,
  maxCostUsd
} from '@mtsrc/agent-tracking-spec';
import { type VendorSource } from '@mtsrc/agent-tracking-model-resolver';
import {
  addTokens,
  type Amount,
  emptyTokens,
  parseAmount,
  toDecimal,
  type Tokens
} from '@mtsrc/agent-tracking-cost';
import { positiveCount, record, text } from './fields';

let preferredBases = ['billed', 'contract', 'server_estimate', 'client_estimate'] as const;
let centsPerUsd = 100n;
let catalogFirstFamilies = new Set(['opencode']);
let maxClientUsdPerMillionTokens = 1000n;

let maxCommitRefs = 50;
let maxPullRequestRefs = 20;
let commitTimeAheadMs = 5 * 60 * 1000;
let commitTimeBeforeSessionMs = 30 * 24 * 60 * 60 * 1000;

let vendorSourceOrder: VendorSource[] = [
  'reported',
  'endpoint',
  'offering',
  'agent',
  'first-party'
];

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
  | 'metorial'
>;

export type SessionAggregate = {
  records: number;
  empty: boolean;
  summary: SessionSummary;
  slices: BaseSlice[];
  coverage: Omit<SessionCoverage, 'fullyAttributed'>;
  correlations: Correlation[];
  mcpToolCalls: SessionMcpToolCallRef[];
  toolCallRepoIds: (string | null)[];
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
  baseUrl?: string;
  purpose?: string;
  userId?: string;
  billing: Billing;
  tokens?: RequestTokens;
  aggregate: boolean;
  costs: CostEntry[];
  failed: boolean;
  errorClass?: string;
  keyed: boolean;
};

type ModelTotals = Grouped & {
  summary: SessionModelSummary;
  rawIds: Set<string>;
  vendorSource?: VendorSource;
  offering?: { id: string; at: Date };
  periods: Map<string, PricePeriod>;
  priceAssumed: boolean;
};

type Costed = {
  costs: Map<string, CostEntry>;
  computed?: Amount;
  contract?: Amount;
};

type SliceTotals = Costed & {
  slice: Omit<
    BaseSlice,
    'lines' | 'costReported' | 'costComputedUsd' | 'costContractUsd' | 'costUsd'
  >;
  preferred?: Amount;
  codeLines: Lines;
  toolLines: Lines;
  statsLines: Lines;
};

type Grouped = Costed & { tokens: Tokens };

type CostedEntry = { costs: CostEntry[]; computed?: Amount; contract?: Amount };

type CumulativeLines = { occurredAt: Date; added: number; removed: number };

type PullRequestEntry = { ref: SessionPullRequestRef; at: Date };

type CommitEntry = { ref: SessionCommitRef; committedAt?: Date };

type Lines = { added: number; removed: number };

type Span = { first?: Date; firstSubagentId?: string; last?: Date; endedAt: number };

let widen = (span: Span, occurredAt: Date, durationMs: number, subagentId?: string) => {
  if (!span.first || occurredAt < span.first) {
    span.first = occurredAt;
    span.firstSubagentId = subagentId;
  }

  if (!span.last || occurredAt > span.last) span.last = occurredAt;

  span.endedAt = Math.max(span.endedAt, occurredAt.getTime() + durationMs);
};

let strongerSource = (a: VendorSource | undefined, b: VendorSource | undefined) =>
  !a || (b && vendorSourceOrder.indexOf(b) < vendorSourceOrder.indexOf(a)) ? b : a;

let purposeOf = (family: string, data: Record<string, unknown>) => {
  let purpose = text(data.purpose);
  let agentName = text(data.agent_name);

  let legacyMain =
    family == 'claude-code' &&
    purpose == 'subagent' &&
    agentName !== undefined &&
    isClaudeCodeMainQuerySource(agentName);

  return legacyMain ? 'main' : purpose;
};

export let readTokens = (value: unknown): RequestTokens | undefined => {
  let usage = record(value);
  if (!usage) return undefined;

  let cacheWrite5m = positiveCount(usage.cacheWrite5m);
  let cacheWrite1h = positiveCount(usage.cacheWrite1h);

  let tokens: RequestTokens = {
    inputUncached: positiveCount(usage.inputUncached),
    cacheRead: positiveCount(usage.cacheRead),
    cacheWrite: positiveCount(usage.cacheWrite) || cacheWrite5m + cacheWrite1h,
    output: positiveCount(usage.output),
    reasoning: positiveCount(usage.reasoning),
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

let boundedClientCosts = (costs: CostEntry[], tokens: RequestTokens | undefined) => {
  let usdCosts = costs.filter(cost => usdAmount(cost) !== undefined);
  if (!usdCosts.length) return costs;

  let usd = usdCosts.reduce((sum, cost) => sum + usdAmount(cost)!, 0n);
  let counted = tokens
    ? tokens.inputUncached +
      tokens.cacheRead +
      tokens.cacheWrite +
      tokens.output +
      tokens.reasoning
    : 0;
  let perMessage = parseAmount(maxCostUsd)!;
  let byTokens =
    (BigInt(counted) * parseAmount(1)! * maxClientUsdPerMillionTokens) / 1_000_000n;
  let cap = counted > 0 && byTokens < perMessage ? byTokens : perMessage;

  return [
    ...costs.filter(cost => usdAmount(cost) === undefined),
    { unit: 'usd', basis: usdCosts[0]!.basis, amount: usd < cap ? usd : cap }
  ];
};

let addCosted = (
  group: Costed,
  item: { reported: CostEntry[]; computed?: Amount; contract?: Amount }
) => {
  for (let cost of item.reported) addCost(group.costs, cost);
  if (item.computed !== undefined) group.computed = (group.computed ?? 0n) + item.computed;
  if (item.contract !== undefined) group.contract = (group.contract ?? 0n) + item.contract;
};

let costFieldsOf = (group: Costed) => ({
  costReported: reportedCosts(group.costs),
  ...(group.computed !== undefined ? { costComputedUsd: toDecimal(group.computed) } : {}),
  ...(group.contract !== undefined ? { costContractUsd: toDecimal(group.contract) } : {})
});

export let reportedCosts = (costs: Map<string, CostEntry>): ReportedCost[] =>
  [...costs.values()].map(cost => ({
    unit: cost.unit,
    basis: cost.basis,
    amount: toDecimal(cost.amount)
  }));

let increment = (target: Record<string, number>, key: string) => {
  target[key] = (target[key] ?? 0) + 1;
};

let strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry == 'string')
    : undefined;

let dateOf = (value: unknown) => {
  let date = typeof value == 'string' ? new Date(value) : undefined;

  return date && Number.isFinite(date.getTime()) ? date : undefined;
};

let mergeCommitRef = (
  refs: Map<string, CommitEntry>,
  key: string,
  occurredAt: Date,
  data: Record<string, unknown>
) => {
  let sha = text(data.sha);
  if (!sha) return;

  let entry = refs.get(key) ?? { ref: { sha, at: occurredAt } };
  let { ref } = entry;
  if (occurredAt < ref.at) ref.at = occurredAt;

  let branch = text(data.branch);
  let ticketRefs = strings(data.ticketRefs);

  if (branch && !ref.branch) ref.branch = branch;
  if (ticketRefs?.length && !ref.ticketRefs) ref.ticketRefs = ticketRefs;
  entry.committedAt ??= dateOf(data.committedAt);

  refs.set(key, entry);
};

let commitTime = (entry: CommitEntry, sessionStart: Date | undefined) => {
  let { committedAt } = entry;
  if (!committedAt) return entry.ref.at;

  let tooLate = committedAt.getTime() > entry.ref.at.getTime() + commitTimeAheadMs;
  let tooEarly =
    !!sessionStart &&
    committedAt.getTime() < sessionStart.getTime() - commitTimeBeforeSessionMs;

  return tooLate || tooEarly ? entry.ref.at : committedAt;
};

let mergePullRequestRef = (
  refs: Map<string, PullRequestEntry>,
  occurredAt: Date,
  data: Record<string, unknown>
) => {
  let provider = text(data.provider);
  let repository = text(data.repository);
  let number = typeof data.number == 'number' ? data.number : undefined;
  let kind = data.kind == 'linked' ? ('linked' as const) : ('opened' as const);
  if (!provider || !repository || !number) return;

  let key = `${provider}/${repository}#${number}`;
  let entry = refs.get(key) ?? {
    ref: { key, provider, repository, number, kind },
    at: occurredAt
  };
  if (occurredAt > entry.at) entry.at = occurredAt;
  if (kind == 'opened') entry.ref.kind = kind;

  refs.set(key, entry);
};

let newestFirst = <T extends { at: Date }>(entries: Iterable<T>, limit: number) =>
  [...entries].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);

export type CostBasis = (typeof preferredBases)[number] | 'computed';

let hasBasis = (entry: CostedEntry, basis: (typeof preferredBases)[number]) =>
  basis == 'contract'
    ? entry.contract !== undefined
    : entry.costs.some(cost => cost.basis == basis && usdAmount(cost) !== undefined);

export let selectCostBasis = (entries: CostedEntry[]): CostBasis | undefined => {
  for (let basis of preferredBases) {
    if (entries.some(entry => hasBasis(entry, basis))) return basis;
  }

  return entries.some(entry => entry.computed !== undefined) ? 'computed' : undefined;
};

// Under the contract basis a request no override priced counts at its list cost, so an override
// that covers only part of a session doesn't drop the rest of its cost.
export let preferredAmount = (
  entry: CostedEntry,
  basis: CostBasis | undefined
): Amount | undefined => {
  if (!basis) return undefined;
  if (basis == 'computed') return entry.computed;
  if (basis == 'contract') return entry.contract ?? entry.computed;

  let total: Amount | undefined;

  for (let cost of entry.costs) {
    let usd = cost.basis == basis ? usdAmount(cost) : undefined;
    if (usd !== undefined) total = (total ?? 0n) + usd;
  }

  return total;
};

let billingKey = (billing: Billing | undefined) =>
  billing ? [billing.mode, billing.source ?? '', billing.plan ?? ''].join('|') : '||';

let billingFields = (billing: Billing | undefined) =>
  billing
    ? {
        billingMode: billing.mode,
        ...(billing.source ? { billingSource: billing.source } : {}),
        ...(billing.plan ? { billingPlan: billing.plan } : {})
      }
    : {};

let selectUsageSource = (usage: UsageEntry[]) => {
  let usageBearing = usage.filter(entry => entry.tokens || entry.costs.length);
  let winnerRank = Math.min(...usageBearing.map(entry => entry.rank));
  let winner = usageBearing.find(entry => entry.rank == winnerRank)?.source;

  let requestEntries = usage.filter(entry => entry.type == 'model.request');
  let winnerHasRequests = requestEntries.some(entry => entry.rank == winnerRank);

  // A keyed transcript request fills a gap in the winning source only when all of that source's
  // usage requests are keyed; otherwise it could be counted twice.
  let winnerUsageRequests = requestEntries
    .filter(entry => entry.rank == winnerRank && (entry.tokens || entry.costs.length))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let fillsGaps =
    winnerUsageRequests.length > 0 && winnerUsageRequests.every(entry => entry.keyed);
  let isGapFill = (entry: UsageEntry) =>
    fillsGaps && entry.keyed && entry.source == 'transcript' && entry.rank != winnerRank;
  let countsUsageOf = (entry: UsageEntry) => entry.rank == winnerRank || isGapFill(entry);

  // The transcript has no billing, so a gap takes the billing of the nearest earlier winning
  // request (else the first).
  for (let entry of usage) {
    if (!isGapFill(entry)) continue;

    let nearest =
      winnerUsageRequests.findLast(other => other.occurredAt <= entry.occurredAt) ??
      winnerUsageRequests[0]!;

    entry.billing = { ...nearest.billing };
  }

  return {
    hasUsage: usageBearing.length > 0,
    winner,
    winnerRank,
    requestEntries,
    winnerHasRequests,
    isGapFill,
    countsUsageOf
  };
};

let priceUsage = async (d: {
  usage: UsageEntry[];
  selection: ReturnType<typeof selectUsageSource>;
  family: string;
  catalog: CatalogIndex | null;
  pricing?: OverridePricer | null;
}) => {
  let modelByCorrelation = new Map<string, UsageEntry>();

  for (let entry of d.selection.requestEntries) {
    if (!entry.modelRaw) continue;

    if (entry.turnId) modelByCorrelation.set(`turn:${entry.turnId}`, entry);
    if (entry.requestId) modelByCorrelation.set(`request:${entry.requestId}`, entry);
  }

  let requestOf = (entry: UsageEntry): ModelRequest | undefined =>
    entry.modelRaw
      ? {
          raw: entry.modelRaw,
          provider: entry.provider,
          family: d.family,
          baseUrl: entry.baseUrl,
          subscription: isSubscriptionBilling(entry.billing)
        }
      : undefined;

  let resolver = d.catalog
    ? await d.catalog.prepare(d.usage.flatMap(entry => requestOf(entry) ?? []))
    : null;

  let resolve = (entry: UsageEntry, at: Date): ResolvedModel => {
    let request = requestOf(entry);
    return request && resolver ? resolver.resolveModel({ ...request, at }) : {};
  };

  return d.usage
    .filter(entry =>
      entry.type == 'model.request'
        ? !d.selection.winnerHasRequests || d.selection.countsUsageOf(entry)
        : entry.rank == d.selection.winnerRank
    )
    .map(entry => {
      let modelSource =
        entry.modelRaw || entry.type == 'model.request'
          ? entry
          : (modelByCorrelation.get(`request:${entry.requestId}`) ??
            modelByCorrelation.get(`turn:${entry.turnId}`) ??
            entry);

      let resolution = resolve(modelSource, entry.occurredAt);

      let countsUsage = d.selection.countsUsageOf(entry);
      let tokens = countsUsage ? entry.tokens : undefined;
      let catalogFirst = catalogFirstFamilies.has(d.family);
      let reported = countsUsage ? entry.costs : [];
      if (catalogFirst) reported = boundedClientCosts(reported, tokens);

      // Usage summed over several model calls says nothing about the size of any one context,
      // so it is priced at the base tier, as sessionless rollups are.
      let contextTokens =
        tokens && !entry.aggregate
          ? tokens.inputUncached + tokens.cacheRead + tokens.cacheWrite
          : 0;
      let computedNumber =
        resolution.period && tokens
          ? computeRequestCost({ pricing: resolution.period.pricing, tokens, contextTokens })
          : undefined;
      let listed = computedNumber === undefined ? undefined : parseAmount(computedNumber);
      let computed = listed;
      let costs = catalogFirst && listed !== undefined ? [] : reported;

      let contract =
        d.pricing && (tokens || costs.length)
          ? d.pricing({
              at: entry.occurredAt,
              resolution,
              billingMode: entry.billing.mode,
              list: computed,
              tokens,
              contextTokens
            })
          : undefined;

      return {
        entry,
        resolution,
        modelId: resolution.modelId,
        modelRaw: modelSource.modelRaw,
        provider: modelSource.provider,
        tokens,
        costs,
        reported,
        catalogFirst,
        computed,
        overrideId: contract?.override.id,
        contract: contract?.amount
      };
    });
};

export let aggregateSession = async (d: {
  records: AsyncIterable<SummaryRecord> | Iterable<SummaryRecord>;
  family: string;
  catalog: CatalogIndex | null;
  pricing?: OverridePricer | null;
  declarations?: DeclarationLookup | null;
  correlationsSince?: Date;
  hasMeasurements?: () => Promise<boolean>;
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
  let ownSpan: Span = { endedAt: 0 };
  let anySpan: Span = { endedAt: 0 };
  let lastTurnObservedAt: Date | undefined;
  let fromDesktop = false;
  let worked = false;

  let turns = 0;
  let prompts = 0;
  let retries = 0;
  let toolCalls = 0;
  let toolCallsByClass: Record<string, number> = {};
  let mcpServers = new Set<string>();
  let subagentNames = new Map<string, string>();
  let codeLines = { added: 0, removed: 0 };
  let toolLines = { added: 0, removed: 0 };
  let pullRequests = 0;
  let commitRefs = new Map<string, CommitEntry>();
  let pullRequestRefs = new Map<string, PullRequestEntry>();
  let statsSamples: CumulativeLines[] = [];
  let errorsByClass: Record<string, number> = {};
  let compactions = 0;
  let hasContext = false;
  let hasRepo = false;
  let sessionProvider: string | undefined;

  let correlations = new Map<string, Correlation>();
  let toolCallPass = createSessionToolCallPass();
  let usage: UsageEntry[] = [];
  let requestSlots = new Map<string, number>();
  let slices = new Map<string, SliceTotals>();

  let sliceFor = (d: {
    occurredAt: Date;
    modelId?: string;
    modelRaw?: string;
    provider?: string;
    vendorId?: string;
    vendorSource?: VendorSource;
    billing?: Billing;
    subagentId?: string;
  }) => {
    let bucket = bucketStart(d.occurredAt, 15);
    let modelKey = d.modelId ?? (d.modelRaw ? `raw:${d.modelRaw}` : '');
    let key = [
      bucket.toISOString(),
      modelKey,
      d.vendorId ?? '',
      d.vendorSource ?? '',
      billingKey(d.billing),
      d.subagentId ?? ''
    ].join('|');

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
          ...(d.vendorId ? { vendorId: d.vendorId } : {}),
          ...(d.vendorSource ? { vendorSource: d.vendorSource } : {}),
          ...billingFields(d.billing),
          sessionsStarted: 0,
          turns: 0,
          requests: 0,
          failedRequests: 0,
          toolCalls: 0,
          tokens: emptyTokens()
        },
        costs: new Map(),
        codeLines: { added: 0, removed: 0 },
        toolLines: { added: 0, removed: 0 },
        statsLines: { added: 0, removed: 0 }
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

    widen(anySpan, occurredAt, document.durationMs ?? 0, subagentId);
    if (movesSessionBounds({ origin: ctx.sessionOrigin, role: document.source.role })) {
      widen(ownSpan, occurredAt, document.durationMs ?? 0, subagentId);
    }

    if (!d.correlationsSince || document.observedAt > d.correlationsSince) {
      for (let correlation of documentCorrelations(document)) {
        correlations.set(`${correlation.type}:${correlation.value}`, correlation);
      }
    }

    toolCallPass.add(document);

    if (document.type == 'session.context') hasContext = true;
    if (document.attribution?.workspaceId) hasContext = true;
    if (document.attribution?.repoId) hasContext = hasRepo = true;
    if (document.source.dialect == desktopContextId) fromDesktop = true;

    // Turns and usage count in every role, since some clients send them only as aggregates or
    // spans; a connection warmup is no work.
    let tokens = readTokens(data.usage);
    let cost = readCost(data.cost);

    if (document.type == 'turn.completed' || ((tokens || cost) && data.warmup !== true)) {
      worked = true;
    }

    if (document.source.role != 'primary') continue;

    let dedupeKey = document.source.factKey ?? document._id;
    let keyedRequest = document.type == 'model.request' && !!document.source.factKey;

    if (document.type == 'vcs.commit') {
      mergeCommitRef(commitRefs, dedupeKey, occurredAt, data);
    }
    if (document.type == 'vcs.pull_request') {
      mergePullRequestRef(pullRequestRefs, occurredAt, data);
    }

    if (!keyedRequest && !isNew(document.type, dedupeKey)) continue;

    let error = record(data.error);
    let errorClass = text(error?.class);

    switch (document.type) {
      case 'session.start':
        sessionProvider ??= text(data.provider);
        break;

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
          toolLines.added += positiveCount(lines.added);
          toolLines.removed += positiveCount(lines.removed);
          totals.toolLines.added += positiveCount(lines.added);
          totals.toolLines.removed += positiveCount(lines.removed);
        }

        break;
      }

      case 'code.change': {
        let lines = record(data.lines);
        if (!lines) break;

        if (data.cumulative === true) {
          statsSamples.push({
            occurredAt,
            added: positiveCount(lines.added),
            removed: positiveCount(lines.removed)
          });
          break;
        }

        let totals = sliceFor({ occurredAt, subagentId });

        codeLines.added += positiveCount(lines.added);
        codeLines.removed += positiveCount(lines.removed);
        totals.codeLines.added += positiveCount(lines.added);
        totals.codeLines.removed += positiveCount(lines.removed);
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

    let model = record(data.model);
    let target = record(data.for);

    if (document.type == 'turn.completed' && !tokens && !cost) continue;

    let source = sourceKindOf({
      channel: document.source.channel,
      type: document.type,
      data
    });

    let entry: UsageEntry = {
      type: document.type,
      rank: usageRank(d.family, source),
      source,
      occurredAt,
      subagentId,
      turnId: text(target?.turnId) ?? ctx.turnId,
      requestId: text(target?.requestId) ?? ctx.requestId,
      modelRaw: text(model?.id),
      provider: text(model?.provider),
      baseUrl: text(model?.baseUrl),
      purpose: purposeOf(d.family, data),
      userId: document.attribution?.userId,
      billing: reportedBilling({ billing: data.billing, authMode: document.client.authMode }),
      tokens,
      aggregate: record(data.usage)?.provenance == 'aggregate',
      costs: cost ? [cost] : [],
      failed: document.type == 'model.request' && !!data.outcome && data.outcome != 'ok',
      errorClass,
      keyed: keyedRequest
    };

    let slot = keyedRequest ? requestSlots.get(dedupeKey) : undefined;

    if (slot === undefined) {
      let index = usage.push(entry) - 1;
      if (keyedRequest) requestSlots.set(dedupeKey, index);
    } else if (entry.rank < usage[slot]!.rank) {
      usage[slot] = entry;
    }
  }

  for (let entry of usage) {
    if (entry.failed) increment(errorsByClass, entry.errorClass ?? 'unknown');
  }

  let selection = selectUsageSource(usage);
  let { hasUsage, winner, requestEntries, isGapFill } = selection;

  // A session-level provider that overrides the sign-in also tells where requests without their
  // own provider went.
  if (sessionProviderBilling({ family: d.family, provider: sessionProvider })) {
    for (let entry of usage) entry.provider ??= sessionProvider;
  }

  resolveBillings({
    family: d.family,
    agentId: d.catalog?.vendors.agent(d.family)?.id,
    sessionProvider,
    entries: usage,
    declarations: d.declarations,
    defaultBilling: defaultBillingOf(d.family)
  });

  let counted = await priceUsage({
    usage,
    selection,
    family: d.family,
    catalog: d.catalog,
    pricing: d.pricing
  });

  let basis = selectCostBasis(counted);

  let totals: Grouped = { tokens: emptyTokens(), costs: new Map() };
  let models = new Map<string, ModelTotals>();
  let subagents = new Map<string, { requests: number; costUsd?: Amount }>();
  let costUsd: Amount | undefined;
  let requests = 0;
  let failedRequests = 0;

  for (let item of counted) {
    let isRequest = item.entry.type == 'model.request';

    let preferred = item.catalogFirst
      ? (preferredAmount(item, basis == 'contract' ? 'contract' : 'computed') ??
        preferredAmount(item, 'client_estimate'))
      : (preferredAmount(item, basis) ??
        (isGapFill(item.entry) && basis != 'billed' ? item.computed : undefined));

    if (isRequest) {
      requests++;
      if (item.entry.failed) failedRequests++;
    }

    if (item.tokens) addTokens(totals.tokens, item.tokens);
    addCosted(totals, item);
    if (preferred !== undefined) costUsd = (costUsd ?? 0n) + preferred;

    let { vendorId, vendorSource, offering, period } = item.resolution;
    let modelKey = item.modelId ?? (item.modelRaw ? `raw:${item.modelRaw}` : undefined);

    let billing = item.entry.billing;

    if (modelKey) {
      let key = [modelKey, vendorId ?? '', item.overrideId ?? '', billingKey(billing)].join(
        '\0'
      );
      let model = models.get(key);

      if (!model) {
        model = {
          tokens: emptyTokens(),
          costs: new Map(),
          rawIds: new Set(),
          periods: new Map(),
          priceAssumed: false,
          summary: {
            ...(item.modelId ? { modelId: item.modelId } : {}),
            ...(vendorId ? { vendorId } : {}),
            ...(item.overrideId ? { overrideId: item.overrideId } : {}),
            ...billingFields(billing),
            rawIds: [],
            requests: 0,
            tokens: emptyTokens(),
            costReported: []
          }
        };

        models.set(key, model);
      }

      if (item.modelRaw) model.rawIds.add(item.modelRaw);
      if (isRequest) model.summary.requests++;
      if (item.tokens) addTokens(model.tokens, item.tokens);
      addCosted(model, item);

      model.vendorSource = strongerSource(model.vendorSource, vendorSource);
      if (offering && (!model.offering || item.entry.occurredAt >= model.offering.at)) {
        model.offering = { id: offering.id, at: item.entry.occurredAt };
      }
      if (period) model.periods.set(period.id, period);
      if (item.resolution.priceAssumed) model.priceAssumed = true;
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
      vendorId,
      vendorSource,
      billing,
      subagentId: item.entry.subagentId
    });

    if (isRequest) {
      slice.slice.requests++;
      if (item.entry.failed) slice.slice.failedRequests++;
    }

    if (item.tokens) addTokens(slice.slice.tokens, item.tokens);
    addCosted(slice, item);
    if (preferred !== undefined) slice.preferred = (slice.preferred ?? 0n) + preferred;
  }

  statsSamples.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let peak = { added: 0, removed: 0 };

  for (let sample of statsSamples) {
    let totals = sliceFor({ occurredAt: sample.occurredAt });

    totals.statsLines.added += Math.max(0, sample.added - peak.added);
    totals.statsLines.removed += Math.max(0, sample.removed - peak.removed);
    peak = {
      added: Math.max(peak.added, sample.added),
      removed: Math.max(peak.removed, sample.removed)
    };
  }

  let latestSample = statsSamples[statsSamples.length - 1];
  let statsLines = {
    added: latestSample?.added ?? 0,
    removed: latestSample?.removed ?? 0
  };

  let hasLines = (lines: Lines) => lines.added + lines.removed > 0;
  let lineSource: 'codeLines' | 'toolLines' | 'statsLines' = hasLines(codeLines)
    ? 'codeLines'
    : hasLines(toolLines)
      ? 'toolLines'
      : 'statsLines';

  let lines = { codeLines, toolLines, statsLines }[lineSource];

  // A thread in which nothing happened, like one that only warmed up its connection, is kept but
  // not listed or counted as a session.
  let empty =
    !worked &&
    !prompts &&
    !toolCalls &&
    !requestEntries.length &&
    !commitRefs.size &&
    !pullRequestRefs.size &&
    !hasLines(lines) &&
    !fromDesktop &&
    !(await d.hasMeasurements?.());

  let span = ownSpan.first ? ownSpan : anySpan;

  if (span.first && !empty) {
    sliceFor({
      occurredAt: span.first,
      subagentId: span.firstSubagentId
    }).slice.sessionsStarted = 1;
  }

  let subagentIds = new Set([...subagentNames.keys(), ...subagents.keys()]);

  let summary: SessionSummary = {
    durationMs: span.first ? Math.max(0, span.endedAt - span.first.getTime()) : 0,
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
      ...(model.vendorSource ? { vendorSource: model.vendorSource } : {}),
      ...(model.offering ? { offeringId: model.offering.id } : {}),
      ...(model.periods.size
        ? {
            pricePeriodIds: [...model.periods.values()]
              .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
              .map(period => period.id)
          }
        : {}),
      ...(model.priceAssumed ? { priceAssumed: true as const } : {}),
      tokens: model.tokens,
      ...costFieldsOf(model)
    })),
    tokens: totals.tokens,
    ...costFieldsOf(totals),
    ...(costUsd !== undefined ? { costUsd: toDecimal(costUsd) } : {}),
    lines,
    commits: commitRefs.size,
    pullRequests,
    commitRefs: newestFirst(
      [...commitRefs.values()].map(entry => ({
        ...entry.ref,
        at: commitTime(entry, span.first)
      })),
      maxCommitRefs
    ),
    pullRequestRefs: newestFirst(pullRequestRefs.values(), maxPullRequestRefs).map(
      entry => entry.ref
    ),
    errorsByClass,
    compactions
  };

  return {
    records,
    empty,
    summary,
    slices: [...slices.values()].map(totals => ({
      ...totals.slice,
      ...costFieldsOf(totals),
      ...(totals.preferred !== undefined ? { costUsd: toDecimal(totals.preferred) } : {}),
      lines: totals[lineSource]
    })),
    coverage: {
      hasUsage,
      hasContext,
      hasRepo,
      ...(winner ? { usageSource: winner } : {})
    },
    correlations: [...correlations.values()],
    ...toolCallPass.result(),
    firstOccurredAt: span.first,
    lastOccurredAt: span.last,
    lastTurnObservedAt
  };
};
