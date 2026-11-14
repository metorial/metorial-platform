import { describe, expect, it } from 'vitest';
import { emptyUsage, formatStepLog, type ReviewModel } from '../src';

let model: ReviewModel = {
  slug: 'glm-5-3',
  model: 'glm',
  pricing: {
    inputPerMillion: 1,
    outputPerMillion: 2,
    cacheReadPerMillion: 0.5,
    cacheWritePerMillion: 0
  }
};

let step = (overrides: Record<string, unknown> = {}) =>
  ({
    finishReason: 'tool-calls',
    text: '',
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    content: [],
    usage: {
      inputTokens: 1000,
      outputTokens: 100,
      inputTokenDetails: { noCacheTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 }
    },
    ...overrides
  }) as any;

describe('formatStepLog', () => {
  it('summarizes model, tokens, cost and finish reason', () => {
    let text = formatStepLog({
      step: step(),
      stepNumber: 3,
      model,
      total: { ...emptyUsage(), costMicros: 5000 },
      durationMs: 2500
    });

    expect(text).toBe(
      'step 3 · glm-5-3 · 1000 in / 100 out · $0.0012 (total $0.0050) · 2.5s · tool-calls'
    );
  });

  it('lists tool calls and results and clips long values', () => {
    let text = formatStepLog({
      step: step({
        reasoningText: 'look at\nthe spec',
        toolCalls: [{ toolName: 'bash', input: { command: 'cat spec.json' } }],
        toolResults: [{ toolName: 'bash', output: { stdout: 'x'.repeat(5000) } }]
      }),
      stepNumber: 1,
      model,
      total: emptyUsage(),
      durationMs: 100
    });

    expect(text).toContain('  thinking: look at the spec');
    expect(text).toContain('  → bash {"command":"cat spec.json"}');
    expect(text).toMatch(/ {2}← bash .*… \[\+\d+ chars\]/);
    expect(text.length).toBeLessThan(1500);
  });

  it('includes tool errors', () => {
    let text = formatStepLog({
      step: step({
        content: [{ type: 'tool-error', toolName: 'bash', error: new Error('boom') }]
      }),
      stepNumber: 2,
      model,
      total: emptyUsage(),
      durationMs: 100
    });

    expect(text).toContain('  ✗ bash failed: boom');
  });

  it('omits web queries, raw URLs, page output and provider error details', () => {
    let text = formatStepLog({
      step: step({
        reasoningText: 'Fetching https://docs.vendor.com/private-data now',
        toolCalls: [
          { toolName: 'web_search', input: { query: 'private customer query' } },
          { toolName: 'fetch_url', input: { url: 'https://docs.vendor.com/?token=private' } }
        ],
        toolResults: [{ toolName: 'fetch_url', output: { preview: 'private page text' } }],
        content: [
          {
            type: 'tool-error',
            toolName: 'fetch_url',
            error: new Error('private upstream details')
          }
        ]
      }),
      stepNumber: 1,
      model,
      total: emptyUsage(),
      durationMs: 10
    });

    expect(text).toContain('docs.vendor.com');
    expect(text).toContain('[query omitted]');
    expect(text).not.toContain('private');
    expect(text).not.toContain('https://');
  });
});
