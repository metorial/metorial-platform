import {
  arrayField,
  billingFields,
  boolField,
  commonFields,
  enumField,
  errorClasses,
  field,
  measureField,
  stored,
  storedMeasure,
  timeFields,
  tokenFields,
  toolClasses
} from './fields';
import {
  activeMetrics,
  cacheHitRate,
  count,
  derived,
  errorRate,
  lineMetrics,
  sum,
  tokenMetrics
} from './metrics';
import type { DatasetDef, FieldDef, MetricDef } from './types';

let summaryMeasures: [string, string, 'number' | 'duration', string][] = [
  ['duration', 'summary.durationMs', 'duration', 'Session duration.'],
  ['turns', 'summary.turns', 'number', 'Turns.'],
  ['prompts', 'summary.prompts', 'number', 'Prompts.'],
  ['requests', 'summary.requests', 'number', 'Model requests.'],
  ['requests.failed', 'summary.failedRequests', 'number', 'Failed model requests.'],
  ['retries', 'summary.retries', 'number', 'Retried model requests.'],
  ['tool_calls', 'summary.toolCalls', 'number', 'Tool calls.'],
  ['lines.added', 'summary.lines.added', 'number', 'Lines added.'],
  ['lines.removed', 'summary.lines.removed', 'number', 'Lines removed.'],
  ['commits', 'summary.commits', 'number', 'Commits.'],
  ['pull_requests', 'summary.pullRequests', 'number', 'Pull requests.'],
  ['compactions', 'summary.compactions', 'number', 'Context compactions.']
];

let measureFields: Record<string, FieldDef> = {
  ...Object.fromEntries(
    summaryMeasures.map(([name, path, type, description]) => [
      name,
      storedMeasure(path, type, description)
    ])
  ),
  ...Object.fromEntries(
    toolClasses.map(toolClass => [
      `tool_calls.${toolClass}`,
      storedMeasure(
        `summary.toolCallsByClass.${toolClass}`,
        'number',
        `Tool calls of class ${toolClass}.`
      )
    ])
  ),
  ...Object.fromEntries(
    errorClasses.map(errorClass => [
      `errors.${errorClass}`,
      storedMeasure(
        `summary.errorsByClass.${errorClass}`,
        'number',
        `Errors of class ${errorClass}.`
      )
    ])
  ),
  subagents: measureField(
    { kind: 'size', path: 'summary.subagents' },
    'number',
    'Subagents used.'
  ),
  'cost.usd': storedMeasure('summary.costUsd', 'money', 'Cost in USD.'),
  'cost.list': storedMeasure(
    'summary.costComputedUsd',
    'money',
    'Cost in USD at list prices.'
  ),
  'cost.contract': storedMeasure(
    'summary.costContractUsd',
    'money',
    'Cost in USD at contract prices.'
  ),
  ...tokenFields('summary.tokens')
};

let measureMetrics: Record<string, MetricDef> = Object.fromEntries(
  Object.entries(measureFields)
    .filter(([name]) => !name.startsWith('tokens.') && !name.startsWith('lines.'))
    .map(([name, def]) => [name, sum(name, def.type, def.description)])
);

export let sessionsDataset: DatasetDef = {
  name: 'sessions',
  collection: 'sessions',
  description:
    'One document per session, with its summary, context, attribution and coverage.',
  timeField: 'startedAt',
  maxRangeDays: 400,
  maxHourlyRangeDays: 31,
  retentionDays: 400,
  scopePaths: { project: 'projectId', instance: 'instanceId' },
  kinds: {
    kind: 'embedded',
    arrayPath: 'attribution.entries',
    idsPath: 'attribution.dimIds',
    idKey: 'entityId',
    weightKey: 'weight',
    depthKey: 'depth'
  },
  tagsPath: 'context.tags',
  countable: true,
  rows: true,
  fields: {
    ...commonFields({
      project: 'projectId',
      instance: 'instanceId',
      user: 'observed.userId',
      device: 'observed.deviceId',
      agentId: 'observed.agentId',
      clientFamily: 'client.family',
      clientSurface: 'client.surface',
      clientVersion: 'client.version',
      clientVersionKey: 'client.versionKey',
      session: '_id',
      model: 'summary.models.modelId',
      modelArray: true,
      modelRaw: 'summary.models.rawIds',
      modelRawArray: true,
      repo: { path: 'context.repoIds', array: true },
      workspace: { path: 'context.workspaceIds', array: true }
    }),
    ...billingFields({
      vendor: 'summary.models.vendorId',
      vendorSource: 'summary.models.vendorSource',
      mode: 'summary.models.billingMode',
      source: 'summary.models.billingSource',
      plan: 'summary.models.billingPlan',
      array: true
    }),
    ...timeFields(),
    state: enumField('state', ['active', 'idle', 'ended'], 'The session state.'),
    origin: enumField(
      'origin',
      ['native', 'inferred'],
      'Whether the client reported the session or it was inferred.'
    ),
    ticket: arrayField('context.ticketRefs', 'string', 'Ticket references.', {
      dimension: false,
      cardinality: 'high',
      searchable: true
    }),
    branch: stored('context.branch', 'string', 'The VCS branch.', {
      dimension: false,
      cardinality: 'high',
      searchable: true
    }),
    'mcp.server': arrayField('summary.mcpServers', 'string', 'MCP servers used.', {
      searchable: true
    }),
    'coverage.hasUsage': boolField('coverage.hasUsage', 'Whether usage data arrived.'),
    'coverage.hasContext': boolField('coverage.hasContext', 'Whether context data arrived.'),
    'coverage.hasRepo': boolField('coverage.hasRepo', 'Whether a repository is known.'),
    'coverage.fullyAttributed': boolField(
      'coverage.fullyAttributed',
      'Whether every required kind is attributed.'
    ),
    'coverage.usageSource': stored(
      'coverage.usageSource',
      'string',
      'Where the usage data came from.',
      {
        cardinality: 'low'
      }
    ),
    'classification.status': enumField(
      'classification.status',
      ['pending', 'accepted', 'needs_review', 'rejected', 'skipped'],
      'The classification status.'
    ),
    isSubagent: field({
      type: 'bool',
      source: { kind: 'exists', path: 'parentSessionKey' },
      cardinality: 'low',
      description: 'Whether the session is a subagent session.'
    }),
    startedAt: stored('startedAt', 'date', 'When the session started.', {
      dimension: false,
      cardinality: 'high'
    }),
    endedAt: stored('endedAt', 'date', 'When the session ended.', {
      dimension: false,
      cardinality: 'high'
    }),
    lastActivityAt: stored('lastActivityAt', 'date', 'The session’s last activity.', {
      dimension: false,
      cardinality: 'high'
    }),
    ...measureFields
  },
  metrics: {
    sessions: count('Sessions.'),
    ...measureMetrics,
    'cost.reported': {
      kind: 'reported',
      path: 'summary.costReported',
      description: 'Cost as the client reported it, per unit and basis.'
    },
    ...tokenMetrics(),
    ...lineMetrics(),
    ...activeMetrics(),
    'requests.error_rate': errorRate,
    'cache.hit_rate': cacheHitRate,
    'cost.per_session': derived(
      { div: ['cost.usd', 'sessions'] },
      'money',
      'Cost per session.'
    ),
    'cost.per_request': derived(
      { div: ['cost.usd', 'requests'] },
      'money',
      'Cost per request.'
    ),
    'cost.per_active_user': derived(
      { div: ['cost.usd', 'users.active'] },
      'money',
      'Cost per active user.'
    ),
    'tokens.per_request': derived(
      { div: ['tokens.total', 'requests'] },
      'number',
      'Tokens per request.'
    )
  },
  indexes: [
    { name: 'organizationId_startedAt', keys: ['organizationId', 'startedAt'] },
    {
      name: 'organizationId_attribution.dimIds_startedAt',
      keys: ['organizationId', 'attribution.dimIds', 'startedAt']
    },
    {
      name: 'organizationId_observed.userId_startedAt',
      keys: ['organizationId', 'observed.userId', 'startedAt']
    },
    {
      name: 'organizationId_observed.agentId_startedAt',
      keys: ['organizationId', 'observed.agentId', 'startedAt']
    }
  ]
};
