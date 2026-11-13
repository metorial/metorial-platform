import { decimalString } from '../sessions/decimal';
import { isSummaryStale } from '../sessions/freshness';
import type {
  ReportedCost,
  SessionDocument,
  SessionSummary,
  Tokens
} from '../store/derivedModels';

let tokensPresenter = (tokens: Tokens) => ({
  inputUncached: tokens.inputUncached,
  cacheRead: tokens.cacheRead,
  cacheWrite: tokens.cacheWrite,
  output: tokens.output,
  reasoning: tokens.reasoning
});

let costsPresenter = (costs: ReportedCost[]) =>
  costs.map(cost => ({
    unit: cost.unit,
    basis: cost.basis,
    amount: decimalString(cost.amount)
  }));

let summaryPresenter = (summary: SessionSummary) => ({
  durationMs: summary.durationMs,
  turns: summary.turns,
  prompts: summary.prompts,
  requests: summary.requests,
  failedRequests: summary.failedRequests,
  retries: summary.retries,
  toolCalls: summary.toolCalls,
  toolCallsByClass: summary.toolCallsByClass,
  mcpServers: summary.mcpServers,

  subagents: summary.subagents.map(subagent => ({
    agentId: subagent.agentId ?? null,
    name: subagent.name,
    requests: subagent.requests,
    costUsd: decimalString(subagent.costUsd) ?? null
  })),

  models: summary.models.map(model => ({
    modelId: model.modelId ?? null,
    rawIds: model.rawIds,
    requests: model.requests,
    tokens: tokensPresenter(model.tokens),
    costReported: costsPresenter(model.costReported),
    costComputedUsd: decimalString(model.costComputedUsd) ?? null
  })),

  tokens: tokensPresenter(summary.tokens),
  costReported: costsPresenter(summary.costReported),
  costComputedUsd: decimalString(summary.costComputedUsd) ?? null,
  costUsd: decimalString(summary.costUsd) ?? null,

  lines: { added: summary.lines.added, removed: summary.lines.removed },
  commits: summary.commits,
  pullRequests: summary.pullRequests,
  errorsByClass: summary.errorsByClass,
  compactions: summary.compactions
});

export let sessionPresenter = (session: SessionDocument) => ({
  object: 'groundstation#session',

  sessionKey: session._id,
  projectId: session.projectId,
  instanceId: session.instanceId,

  origin: session.origin,
  state: session.state,
  client: {
    family: session.client.family,
    surface: session.client.surface ?? null,
    version: session.client.version ?? null
  },

  parentSessionKey: session.parentSessionKey ?? null,
  rootSessionKey: session.rootSessionKey,
  continuesSessionKey: session.continuesSessionKey ?? null,

  observed: {
    userId: session.observed?.userId ?? null,
    deviceId: session.observed?.deviceId ?? null,
    agentId: session.observed?.agentId ?? null,
    clientUserIds: session.observed?.clientUserIds ?? [],
    clientInstallationIds: session.observed?.clientInstallationIds ?? []
  },

  context: {
    workspaceIds: session.context?.workspaceIds ?? [],
    repoIds: session.context?.repoIds ?? [],
    branch: session.context?.branch ?? null,
    head: session.context?.head ?? null,
    ticketRefs: session.context?.ticketRefs ?? [],
    tags: (session.context?.tags ?? []).map(tag => ({
      k: tag.k,
      v: tag.v,
      origin: tag.origin
    })),
    pathStored: session.context?.pathStored ?? false
  },

  attribution: (session.attribution?.entries ?? []).map(entry => ({
    kind: entry.kind,
    entityId: entry.entityId,
    role: entry.role ?? null,
    source: entry.source,
    weight: entry.weight,
    confidence: entry.confidence ?? null
  })),

  coverage: {
    hasUsage: session.coverage?.hasUsage ?? false,
    hasContext: session.coverage?.hasContext ?? false,
    hasRepo: session.coverage?.hasRepo ?? false,
    fullyAttributed: session.coverage?.fullyAttributed ?? false,
    usageSource: session.coverage?.usageSource ?? null
  },

  classificationStatus: session.classification?.status ?? null,

  summary: session.summary ? summaryPresenter(session.summary) : null,
  summaryStale: isSummaryStale(session),
  frozen: !!session.frozen,

  startedAt: session.startedAt,
  lastActivityAt: session.lastActivityAt,
  endedAt: session.endedAt ?? null
});
