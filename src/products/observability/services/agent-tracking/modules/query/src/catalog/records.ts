import type { Filter } from '@mtsrc/agent-tracking-query-spec';
import {
  claudeCodePlaceholderNames,
  contentRoles,
  ingestChannels
} from '@mtsrc/agent-tracking-spec';
import {
  arrayField,
  boolField,
  commonFields,
  enumField,
  errorClasses,
  measureField,
  outcomes,
  reportedBillingFields,
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
  distinct,
  errorRate,
  failed,
  lineMetrics,
  max,
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

let claudeCode: Filter = { field: 'client.family', op: 'eq', value: 'claude-code' };

// Older Claude Code records stored a redacted MCP call as an unknown tool named by placeholder.
let mcpCall: Filter = {
  or: [
    { field: 'tool.kind', op: 'eq', value: 'mcp' },
    {
      and: [
        claudeCode,
        { field: 'tool.name', op: 'in', value: [...claudeCodePlaceholderNames.mcpTools] }
      ]
    }
  ]
};

let namedMcpServer: Filter = {
  and: [
    { field: 'mcp.server', op: 'notNull' },
    {
      or: [
        { not: claudeCode },
        { field: 'mcp.server', op: 'notIn', value: [...claudeCodePlaceholderNames.mcpServers] }
      ]
    }
  ]
};

let namedSkill: Filter = {
  and: [
    { field: 'skill.name', op: 'notNull' },
    {
      or: [
        { not: claudeCode },
        { field: 'skill.name', op: 'notIn', value: [...claudeCodePlaceholderNames.skills] }
      ]
    }
  ]
};

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
    'reasoning.effort': stored(
      'data.effort',
      'string',
      'The reasoning effort. Claude Code and Codex report it.',
      { cardinality: 'low' }
    ),
    speed: enumField(
      'data.speed',
      ['standard', 'fast'],
      'The speed tier. Only Claude Code reports it.'
    ),
    finish_reason: stored(
      'data.stopReason',
      'string',
      'Why the model stopped. No client reports it on requests yet, so it is empty today.',
      { cardinality: 'low' }
    ),
    ...reportedBillingFields('data.billing'),
    transport: enumField('data.transport', ['http', 'websocket', 'sse'], 'The transport.'),
    stream: boolField('data.stream', 'Whether the response was streamed.'),
    attempt: stored('data.attempt', 'number', 'The attempt number (1 for the first try).', {
      cardinality: 'low'
    }),
    latency: storedMeasure(
      'data.durationMs',
      'duration',
      'Total latency. Claude Code and clients that send OpenTelemetry GenAI spans report it; Codex does not.'
    ),
    ttft: storedMeasure(
      'data.ttftMs',
      'duration',
      'Time to first token. Only Codex reports it.'
    ),
    ...tokenFields('data.usage')
  },
  metrics: {
    requests: count('Model requests.'),
    'requests.failed': count('Failed model requests.', failed),
    'requests.error_rate': errorRate,
    latency: avg('latency', 'duration', 'Average latency. Codex does not report it.'),
    ttft: avg('ttft', 'duration', 'Average time to first token. Only Codex reports it.'),
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
    'source.channel': enumField(
      'source.channel',
      ingestChannels,
      'How the call arrived, such as otlp.logs (OpenTelemetry logs) or hook.'
    ),
    'content.roles': arrayField(
      'content.role',
      'enum',
      'The kinds of content recorded with the call, such as tool_input. The agent decides what it sends: Claude Code sends tool inputs only with tool details turned on.',
      { enumValues: contentRoles, cardinality: 'low' }
    ),
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
    ...activeMetrics(),
    last_used: max('occurredAt', 'date', 'When any call in the group happened last.'),
    mcp_calls: count(
      'MCP tool calls, including redacted ones Claude Code stored as unknown tools.',
      mcpCall
    ),
    'mcp_calls.failed': count('Failed MCP tool calls.', { and: [mcpCall, failed] }),
    'mcp_calls.named': count('MCP tool calls with a server name.', namedMcpServer),
    'mcp_calls.error_rate': derived(
      { div: ['mcp_calls.failed', 'mcp_calls'] },
      'percent',
      'Share of MCP tool calls that failed.'
    ),
    'mcp_calls.users': distinct('user', 'Distinct users with MCP tool calls.', mcpCall),
    'mcp_calls.last_used': max(
      'occurredAt',
      'date',
      'When the last MCP tool call happened.',
      mcpCall
    )
  },
  indexes: recordIndexes('tool.call')
};

export let skillActivationsDataset: DatasetDef = {
  ...recordBase,
  name: 'skill_activations',
  description: 'One document per skill activation.',
  baseMatch: {
    type: 'extension.event',
    'data.kind': 'skill',
    'data.action': 'activated',
    'source.role': 'primary'
  },
  fields: {
    ...commonFields(recordPaths),
    ...timeFields(),
    occurredAt,
    'skill.name': stored(
      'data.name',
      'string',
      'The skill name. Claude Code sends it only with tool details turned on.',
      { searchable: true, distinct: true }
    ),
    'skill.source': stored(
      'data.source',
      'string',
      'Where the skill comes from, as the client reported it (Codex reports its scope).',
      { cardinality: 'low' }
    ),
    'skill.trigger': stored(
      'data.trigger',
      'string',
      'What activated the skill, as the client reported it.',
      { cardinality: 'low' }
    ),
    'source.channel': enumField(
      'source.channel',
      ingestChannels,
      'How the activation arrived, such as otlp.logs (OpenTelemetry logs).'
    )
  },
  metrics: {
    skill_activations: count('Skill activations.'),
    'skill_activations.named': count(
      'Skill activations with a real skill name, not a placeholder Claude Code sends without tool details.',
      namedSkill
    ),
    ...activeMetrics(),
    last_used: max('occurredAt', 'date', 'When any skill in the group was activated last.')
  },
  indexes: recordIndexes('extension.event')
};
