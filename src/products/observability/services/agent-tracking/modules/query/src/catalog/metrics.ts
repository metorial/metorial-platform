import type { Expr, Filter } from '@mtsrc/agent-tracking-query-spec';
import type { FieldType, MetricDef } from './types';

export let sum = (field: string, type: FieldType, description: string): MetricDef => ({
  kind: 'aggregate',
  fn: 'sum',
  field,
  type,
  description
});

export let avg = (field: string, type: FieldType, description: string): MetricDef => ({
  kind: 'aggregate',
  fn: 'avg',
  field,
  type,
  description
});

export let count = (description: string, where?: Filter): MetricDef => ({
  kind: 'aggregate',
  fn: 'count',
  type: 'number',
  description,
  ...(where ? { where } : {})
});

export let distinct = (field: string, description: string): MetricDef => ({
  kind: 'aggregate',
  fn: 'countDistinct',
  field,
  type: 'number',
  description
});

export let derived = (
  expr: Expr,
  format: 'number' | 'money' | 'percent' | 'duration',
  description: string
): MetricDef => ({ kind: 'derived', expr, format, description });

export let tokenMetrics = (): Record<string, MetricDef> => ({
  tokens: {
    kind: 'composite',
    parts: {
      inputUncached: 'tokens.input',
      cacheRead: 'tokens.cacheRead',
      cacheWrite: 'tokens.cacheWrite',
      output: 'tokens.output',
      reasoning: 'tokens.reasoning'
    },
    total: true,
    description: 'Tokens by component, with their total.'
  },
  'tokens.input': sum('tokens.input', 'number', 'Uncached input tokens.'),
  'tokens.cacheRead': sum('tokens.cacheRead', 'number', 'Tokens read from the cache.'),
  'tokens.cacheWrite': sum('tokens.cacheWrite', 'number', 'Tokens written to the cache.'),
  'tokens.output': sum('tokens.output', 'number', 'Output tokens.'),
  'tokens.reasoning': sum('tokens.reasoning', 'number', 'Reasoning tokens.'),
  'tokens.total': sum('tokens.total', 'number', 'All tokens.')
});

export let lineMetrics = (): Record<string, MetricDef> => ({
  lines: {
    kind: 'composite',
    parts: { added: 'lines.added', removed: 'lines.removed' },
    total: false,
    description: 'Lines added and removed.'
  },
  'lines.added': sum('lines.added', 'number', 'Lines added.'),
  'lines.removed': sum('lines.removed', 'number', 'Lines removed.')
});

export let activeMetrics = (fields: { agents?: boolean } = {}): Record<string, MetricDef> => ({
  'users.active': distinct('user', 'Distinct users.'),
  'devices.active': distinct('device', 'Distinct devices.'),
  ...(fields.agents === false
    ? {}
    : { 'agents.active': distinct('agentId', 'Distinct agents.') })
});

export let cacheHitRate = derived(
  {
    div: [
      'tokens.cacheRead',
      { add: ['tokens.input', 'tokens.cacheRead', 'tokens.cacheWrite'] }
    ]
  },
  'percent',
  'Share of input tokens read from the cache.'
);

export let errorRate = derived(
  { div: ['requests.failed', 'requests'] },
  'percent',
  'Share of requests that failed.'
);

export let failed: Filter = {
  and: [
    { field: 'outcome', op: 'notNull' },
    { field: 'outcome', op: 'neq', value: 'ok' }
  ]
};
