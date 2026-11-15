import {
  boolField,
  commonFields,
  enumField,
  errorClasses,
  measureField,
  outcomes,
  stored,
  storedMeasure,
  timeFields,
  tokenFields,
  toolClasses,
  toolKinds
} from './fields';
import {
  activeMetrics,
  avg,
  count,
  derived,
  errorRate,
  failed,
  lineMetrics,
  tokenMetrics
} from './metrics';
import type { DatasetDef, IndexDef } from './types';

let recordPaths = {
  project: 'projectId',
  instance: 'instanceId',
  user: 'attribution.userId',
  device: 'attribution.deviceId',
  agentId: 'attribution.agentId',
  clientFamily: 'client.family',
  clientSurface: 'client.surface',
  clientVersion: 'client.version',
  clientVersionKey: 'client.versionKey',
  session: 'ctx.sessionKey',
  repo: { path: 'attribution.repoId', array: false },
  workspace: { path: 'attribution.workspaceId', array: false }
};

let recordIndexes = (type: string): IndexDef[] => [
  {
    name: `organizationId_type_occurredAt (${type})`,
    keys: ['organizationId', 'type', 'occurredAt']
  },
  {
    name: 'organizationId_ctx.sessionKey_occurredAt',
    keys: ['organizationId', 'ctx.sessionKey', 'occurredAt']
  },
  {
    name: 'organizationId_attribution.userId_occurredAt',
    keys: ['organizationId', 'attribution.userId', 'occurredAt']
  }
];

let recordBase = {
  collection: 'events' as const,
  timeField: 'occurredAt',
  maxRangeDays: 90,
  maxHourlyRangeDays: 7,
  retentionDays: 90,
  scopePaths: { project: 'projectId', instance: 'instanceId' },
  kinds: { kind: 'semiJoin' as const, sessionKeyPath: 'ctx.sessionKey' },
  countable: true,
  rows: true
};

let occurredAt = stored('occurredAt', 'date', 'When it happened.', {
  dimension: false,
  cardinality: 'high'
});

export let requestsDataset: DatasetDef = {
  ...recordBase,
  name: 'requests',
  description: 'One document per model request.',
  baseMatch: { type: 'model.request', 'source.role': 'primary' },
  fields: {
    ...commonFields({
      ...recordPaths,
      modelFromRaw: 'data.model.id',
      modelRaw: 'data.model.id'
    }),
    ...timeFields(),
    occurredAt,
    purpose: enumField(
      'data.purpose',
      ['main', 'subagent', 'auxiliary', 'title', 'compaction', 'router', 'unknown'],
      'Why the request was made.'
    ),
    outcome: enumField('data.outcome', outcomes, 'How the request ended.'),
    'error.class': enumField(
      'data.error.class',
      errorClasses,
      'The error class of a failed request.'
    ),
    'reasoning.effort': stored('data.reasoningEffort', 'string', 'The reasoning effort.', {
      cardinality: 'low'
    }),
    speed: enumField('data.speed', ['standard', 'fast'], 'The speed tier.'),
    finish_reason: stored('data.finishReason', 'string', 'Why the model stopped.', {
      cardinality: 'low'
    }),
    transport: enumField('data.transport', ['http', 'websocket', 'sse'], 'The transport.'),
    stream: boolField('data.stream', 'Whether the response was streamed.'),
    attempt: stored('data.attempt', 'number', 'The attempt number (1 for the first try).', {
      cardinality: 'low'
    }),
    latency: storedMeasure('data.latency.totalMs', 'duration', 'Total latency.'),
    ttft: storedMeasure('data.latency.ttftMs', 'duration', 'Time to first token.'),
    ...tokenFields('data.usage')
  },
  metrics: {
    requests: count('Model requests.'),
    'requests.failed': count('Failed model requests.', failed),
    'requests.error_rate': errorRate,
    latency: avg('latency', 'duration', 'Average latency.'),
    ttft: avg('ttft', 'duration', 'Average time to first token.'),
    ...tokenMetrics(),
    'cost.reported': {
      kind: 'reported',
      path: 'data.cost',
      description: 'Cost as the client reported it, per unit and basis.'
    },
    ...activeMetrics(),
    'tokens.per_request': derived(
      { div: ['tokens.total', 'requests'] },
      'number',
      'Tokens per request.'
    )
  },
  indexes: recordIndexes('model.request')
};

export let toolCallsDataset: DatasetDef = {
  ...recordBase,
  name: 'tool_calls',
  description: 'One document per tool call.',
  baseMatch: { type: 'tool.call', 'source.role': 'primary' },
  fields: {
    ...commonFields(recordPaths),
    ...timeFields(),
    occurredAt,
    'tool.name': stored('data.tool.name', 'string', 'The tool name.', {
      searchable: true,
      cardinality: 'high'
    }),
    'tool.kind': enumField('data.tool.kind', toolKinds, 'The kind of tool.'),
    'tool.class': enumField('data.tool.class', toolClasses, 'What the tool does.'),
    'mcp.server': stored('data.tool.mcp.server', 'string', 'The MCP server.', {
      searchable: true,
      distinct: true
    }),
    'mcp.tool': stored('data.tool.mcp.tool', 'string', 'The MCP tool.', {
      searchable: true,
      cardinality: 'high'
    }),
    outcome: enumField('data.outcome', outcomes, 'How the call ended.'),
    decision: enumField(
      'data.decision.value',
      ['allow', 'deny', 'abort', 'ask'],
      'The permission decision.'
    ),
    'sandbox.outcome': stored('data.sandbox.outcome', 'string', 'The sandbox outcome.', {
      cardinality: 'low'
    }),
    duration: measureField(
      { kind: 'coalesce', paths: ['data.durationMs', 'durationMs'] },
      'duration',
      'How long the call took.'
    ),
    'result.chars': storedMeasure(
      'data.resultSize.chars',
      'number',
      'Characters in the result.'
    ),
    'lines.added': storedMeasure('data.lines.added', 'number', 'Lines added.'),
    'lines.removed': storedMeasure('data.lines.removed', 'number', 'Lines removed.')
  },
  metrics: {
    tool_calls: count('Tool calls.'),
    'tool_calls.denied': count('Denied or aborted tool calls.', {
      field: 'decision',
      op: 'in',
      value: ['deny', 'abort']
    }),
    'tool_calls.failed': count('Failed tool calls.', failed),
    'tool_calls.denied_rate': derived(
      { div: ['tool_calls.denied', 'tool_calls'] },
      'percent',
      'Share of tool calls denied or aborted.'
    ),
    'tool_calls.error_rate': derived(
      { div: ['tool_calls.failed', 'tool_calls'] },
      'percent',
      'Share of tool calls that failed.'
    ),
    duration: avg('duration', 'duration', 'Average duration.'),
    'result.chars': avg('result.chars', 'number', 'Average result size in characters.'),
    ...lineMetrics(),
    ...activeMetrics()
  },
  indexes: recordIndexes('tool.call')
};
