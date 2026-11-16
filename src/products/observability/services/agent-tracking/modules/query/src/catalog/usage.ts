import {
  billingFields,
  commonFields,
  stored,
  storedMeasure,
  timeFields,
  tokenFields
} from './fields';
import {
  activeMetrics,
  cacheHitRate,
  derived,
  errorRate,
  lineMetrics,
  sum,
  tokenMetrics
} from './metrics';
import type { DatasetDef, FieldDef } from './types';

let noPercentiles = (fields: Record<string, FieldDef>) =>
  Object.fromEntries(
    Object.entries(fields).map(([name, def]) => [
      name,
      def.measure ? { ...def, percentile: false } : def
    ])
  );

export let usageDataset: DatasetDef = {
  name: 'usage',
  collection: 'usageSlices',
  description:
    'Usage slices: cost, tokens, requests and activity per session, 15-minute bucket, model, vendor and billing mode.',
  timeField: 'bucket',
  maxRangeDays: 400,
  maxHourlyRangeDays: 31,
  retentionDays: 400,
  scopePaths: { project: 'projectId', instance: 'instanceId' },
  kinds: {
    kind: 'embedded',
    arrayPath: 'dims',
    idsPath: 'dimIds',
    idKey: 'id',
    weightKey: 'w',
    depthKey: 'd'
  },
  dailyBuckets: { minutesPath: 'bucketMinutes' },
  countable: false,
  rows: false,
  fields: noPercentiles({
    ...commonFields({
      project: 'projectId',
      instance: 'instanceId',
      user: 'userId',
      device: 'deviceId',
      agentId: 'agentId',
      clientFamily: 'client.family',
      clientSurface: 'client.surface',
      clientVersion: 'client.version',
      clientVersionKey: 'client.versionKey',
      session: 'sessionKey',
      model: 'modelId',
      modelRaw: 'modelRaw',
      repo: { path: 'repoIds', array: true },
      workspace: { path: 'workspaceIds', array: true }
    }),
    subagent: stored('subagentId', 'id', 'The subagent entity that made the usage.', {
      label: 'entity',
      entityKind: 'agent',
      distinct: true
    }),
    ...billingFields({
      vendor: 'vendorId',
      vendorSource: 'vendorSource',
      mode: 'billingMode',
      source: 'billingSource',
      plan: 'billingPlan'
    }),
    ...timeFields(),
    'cost.usd': storedMeasure(
      'costUsd',
      'money',
      'Cost in USD (contract price where declared, else list).'
    ),
    'cost.list': storedMeasure('costComputedUsd', 'money', 'Cost in USD at list prices.'),
    'cost.contract': storedMeasure(
      'costContractUsd',
      'money',
      'Cost in USD at contract prices.'
    ),
    ...tokenFields('tokens'),
    requests: storedMeasure('requests', 'number', 'Model requests.'),
    'requests.failed': storedMeasure('failedRequests', 'number', 'Failed model requests.'),
    sessions: storedMeasure('sessionsStarted', 'number', 'Sessions started.'),
    turns: storedMeasure('turns', 'number', 'Turns.'),
    tool_calls: storedMeasure('toolCalls', 'number', 'Tool calls.'),
    'lines.added': storedMeasure('lines.added', 'number', 'Lines added.'),
    'lines.removed': storedMeasure('lines.removed', 'number', 'Lines removed.')
  }),
  metrics: {
    'cost.usd': sum('cost.usd', 'money', 'Cost in USD.'),
    'cost.list': sum('cost.list', 'money', 'Cost in USD at list prices.'),
    'cost.contract': sum('cost.contract', 'money', 'Cost in USD at contract prices.'),
    'cost.reported': {
      kind: 'reported',
      path: 'costReported',
      description: 'Cost as the client reported it, per unit and basis.'
    },
    ...tokenMetrics(),
    requests: sum('requests', 'number', 'Model requests.'),
    'requests.failed': sum('requests.failed', 'number', 'Failed model requests.'),
    sessions: sum('sessions', 'number', 'Sessions started.'),
    turns: sum('turns', 'number', 'Turns.'),
    tool_calls: sum('tool_calls', 'number', 'Tool calls.'),
    ...lineMetrics(),
    ...activeMetrics(),
    'requests.error_rate': errorRate,
    'cache.hit_rate': cacheHitRate,
    'cost.per_request': derived(
      { div: ['cost.usd', 'requests'] },
      'money',
      'Cost per request.'
    ),
    'cost.per_session': derived(
      { div: ['cost.usd', 'sessions'] },
      'money',
      'Cost per session.'
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
    { name: 'organizationId_bucket', keys: ['organizationId', 'bucket'] },
    { name: 'organizationId_dimIds_bucket', keys: ['organizationId', 'dimIds', 'bucket'] },
    { name: 'organizationId_modelId_bucket', keys: ['organizationId', 'modelId', 'bucket'] },
    { name: 'organizationId_modelRaw_bucket', keys: ['organizationId', 'modelRaw', 'bucket'] },
    { name: 'organizationId_vendorId_bucket', keys: ['organizationId', 'vendorId', 'bucket'] },
    {
      name: 'organizationId_billingMode_bucket',
      keys: ['organizationId', 'billingMode', 'bucket']
    },
    {
      name: 'organizationId_client.family_bucket',
      keys: ['organizationId', 'client.family', 'bucket']
    },
    { name: 'organizationId_userId_bucket', keys: ['organizationId', 'userId', 'bucket'] },
    { name: 'organizationId_agentId_bucket', keys: ['organizationId', 'agentId', 'bucket'] }
  ]
};
