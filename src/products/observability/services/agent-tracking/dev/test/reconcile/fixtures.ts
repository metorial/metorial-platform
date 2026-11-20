import type { ServiceSession } from '../../src/reconcile/compare';
import { emptyTokens, type Tokens } from '@mtsrc/agent-tracking-cost';

export let secretText = 'synthetic prompt text that must never reach a report';

export let secretPath = '/synthetic/workspace/never-reported.ts';

export let usage = (d: {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  thinking?: number;
  iterations?: boolean;
}) => ({
  input_tokens: d.input,
  output_tokens: d.output,
  cache_read_input_tokens: d.cacheRead ?? 0,
  cache_creation_input_tokens: d.cacheWrite ?? 0,
  cache_creation: {
    ephemeral_5m_input_tokens: d.cacheWrite ?? 0,
    ephemeral_1h_input_tokens: 0
  },
  output_tokens_details: { thinking_tokens: d.thinking ?? 0 },
  ...(d.iterations
    ? {
        iterations: [
          {
            type: 'message',
            input_tokens: d.input,
            output_tokens: d.output,
            cache_read_input_tokens: d.cacheRead ?? 0,
            cache_creation_input_tokens: d.cacheWrite ?? 0
          }
        ]
      }
    : {})
});

export let assistantLines = (d: {
  messageId: string;
  model?: string;
  blocks: number;
  at: string;
  usage: ReturnType<typeof usage>;
}) =>
  Array.from({ length: d.blocks }, (_, index) => ({
    type: 'assistant',
    sessionId: 'session-a',
    timestamp: d.at,
    cwd: secretPath,
    requestId: `req-${d.messageId}`,
    message: {
      id: d.messageId,
      model: d.model ?? 'claude-opus-4-1-20250805',
      role: 'assistant',
      content: [
        index % 2 == 0
          ? { type: 'text', text: secretText }
          : { type: 'tool_use', name: 'Read', input: { file_path: secretPath } }
      ],
      usage: d.usage
    }
  }));

export let userLine = (at: string) => ({
  type: 'user',
  sessionId: 'session-a',
  timestamp: at,
  cwd: secretPath,
  message: { role: 'user', content: secretText }
});

export let costState = (d: {
  totalCostUSD: number;
  models: Record<string, Partial<Record<string, number>>>;
  hasUnknownModelCost?: boolean;
}) => ({
  type: 'cost-state',
  sessionId: 'session-a',
  totalCostUSD: d.totalCostUSD,
  hasUnknownModelCost: d.hasUnknownModelCost ?? false,
  totalLinesAdded: 3,
  modelUsage: d.models
});

export let tokens = (values: Partial<Tokens>): Tokens => ({ ...emptyTokens(), ...values });

export let serviceSession = (
  d: Partial<ServiceSession> & { tokens: Tokens }
): ServiceSession => ({
  sessionKey: 'key-a',
  family: 'claude-code',
  instanceId: 'inst-a',
  startedAt: new Date('2026-11-01T10:00:00.000Z'),
  summaryStale: false,
  requests: 2,
  toolCalls: 3,
  reportedCostUsd: 0.5,
  computedCostUsd: 0.5,
  models: [
    {
      modelId: 'claude-opus-4-1',
      rawIds: ['claude-opus-4-1-20250805'],
      requests: 2,
      tokens: d.tokens,
      reportedCostUsd: 0.5,
      computedCostUsd: 0.5,
      hasOffering: true,
      pricePeriods: 1
    }
  ],
  ...d
});
