import type { Organization } from '@mtsrc/agent-tracking-db';
import { isSummaryStale } from '@mtsrc/agent-tracking-module-sessions';
import { desktopSettingsOf } from '@mtsrc/agent-tracking-spec';
import type {
  ReportedCost,
  SessionDocument,
  SessionSummary
} from '@mtsrc/agent-tracking-store';
import { decimalString, type Tokens } from '@mtsrc/agent-tracking-cost';

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
    vendorId: model.vendorId ?? null,
    vendorSource: model.vendorSource ?? null,
    offeringId: model.offeringId ?? null,
    pricePeriodIds: model.pricePeriodIds ?? [],
    priceAssumed: !!model.priceAssumed,
    overrideId: model.overrideId ?? null,
    billing: {
      mode: model.billingMode ?? 'unknown',
      source: model.billingSource ?? null,
      plan: model.billingPlan ?? null
    },
    requests: model.requests,
    tokens: tokensPresenter(model.tokens),
    costReported: costsPresenter(model.costReported),
    costComputedUsd: decimalString(model.costComputedUsd) ?? null,
    costContractUsd: decimalString(model.costContractUsd) ?? null
  })),

  tokens: tokensPresenter(summary.tokens),
  costReported: costsPresenter(summary.costReported),
  costComputedUsd: decimalString(summary.costComputedUsd) ?? null,
  costContractUsd: decimalString(summary.costContractUsd) ?? null,
  costUsd: decimalString(summary.costUsd) ?? null,

  lines: { added: summary.lines.added, removed: summary.lines.removed },
  commits: summary.commits,
  pullRequests: summary.pullRequests,

  commitRefs: (summary.commitRefs ?? []).map(commit => ({
    sha: commit.sha,
    at: commit.at,
    branch: commit.branch ?? null,
    ticketRefs: commit.ticketRefs ?? []
  })),

  pullRequestRefs: (summary.pullRequestRefs ?? []).map(pullRequest => ({
    key: pullRequest.key,
    provider: pullRequest.provider,
    repository: pullRequest.repository,
    number: pullRequest.number,
    kind: pullRequest.kind
  })),

  errorsByClass: summary.errorsByClass,
  compactions: summary.compactions,

  metorial: {
    providerIds: summary.metorial?.providerIds ?? [],
    toolKeys: summary.metorial?.toolKeys ?? []
  }
});

export let sessionTitlesShown = (organization: Pick<Organization, 'settings'>) =>
  desktopSettingsOf(organization.settings).sessionTitles;

export let sessionPresenter = ({
  session,
  titles
}: {
  session: SessionDocument;
  titles: boolean;
}) => ({
  object: 'agent_tracking#session',

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
    defaultBranch: session.context?.defaultBranch ?? null,
    worktree: session.context?.worktree ?? null,
    subPath: session.context?.subPath ?? null,
    permissionMode: session.context?.permissionMode ?? null,
    title: titles ? (session.context?.title ?? null) : null,
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
