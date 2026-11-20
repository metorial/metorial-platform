import { describe, expect, it } from 'vitest';
import { readCostState, readMessageUsage } from '../../src/reconcile/claude';
import {
  compareClaudeSession,
  compareCodexSession,
  compareCostStateWithMessages,
  costTolerance
} from '../../src/reconcile/compare';
import { assistantLines, costState, serviceSession, tokens, usage } from './fixtures';

let model = 'claude-opus-4-1-20250805';

let transcript = (blocks = 1) => [
  ...assistantLines({
    messageId: 'msg_1',
    blocks,
    at: '2026-11-01T10:00:00.000Z',
    usage: usage({ input: 100, output: 20, cacheRead: 400, cacheWrite: 50, thinking: 8 })
  }),
  ...assistantLines({
    messageId: 'msg_2',
    blocks,
    at: '2026-11-01T10:01:00.000Z',
    usage: usage({ input: 60, output: 10, cacheRead: 300 })
  })
];

let clientState = (overrides: Record<string, number> = {}, totalCostUSD = 0.5) =>
  readCostState([
    costState({
      totalCostUSD,
      models: {
        [model]: {
          inputTokens: 160,
          outputTokens: 30,
          thinkingTokens: 8,
          cacheReadInputTokens: 700,
          cacheCreationInputTokens: 50,
          costUSD: totalCostUSD,
          ...overrides
        }
      }
    })
  ]);

let agreed = tokens({ inputUncached: 160, output: 30, cacheRead: 700, cacheWrite: 50 });

let agreedPart = (input: number, output: number, cacheRead: number, cacheWrite: number) =>
  tokens({ inputUncached: input, output, cacheRead, cacheWrite });

let compare = (d: {
  service?: Parameters<typeof serviceSession>[0];
  state?: ReturnType<typeof clientState>;
  blocks?: number;
}) =>
  compareClaudeSession({
    costState: d.state === undefined ? clientState() : d.state,
    messages: readMessageUsage([transcript(d.blocks)]),
    service: serviceSession(d.service ?? { tokens: agreed })
  });

describe('compareClaudeSession', () => {
  it('passes when tokens match per component and cost within rounding, explaining thinking', () => {
    let result = compare({ service: { tokens: agreed, reportedCostUsd: 0.5000004 } });

    expect(result).toMatchObject({
      reference: 'cost_state',
      costStateBehind: false,
      status: 'pass'
    });
    expect(result.findings).toEqual([
      expect.objectContaining({
        check: 'tokens',
        component: 'reasoning',
        client: 8,
        service: 0,
        explanation: 'thinking_only_in_transcript',
        failure: false
      }),
      expect.objectContaining({
        check: 'model_tokens',
        model: 'claude-opus-4-1',
        component: 'reasoning',
        explanation: 'thinking_only_in_transcript',
        failure: false
      })
    ]);
  });

  it('fails on any other token difference', () => {
    let result = compare({ service: { tokens: { ...agreed, cacheRead: 699 } } });

    expect(result.status).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        check: 'tokens',
        component: 'cacheRead',
        client: 700,
        service: 699,
        explanation: null,
        failure: true
      })
    );
  });

  it('names a figure that counts every content-block line, and fails it', () => {
    let doubled = { ...agreed, inputUncached: 320 };
    let result = compare({ blocks: 2, service: { tokens: doubled } });

    expect(result.status).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        check: 'tokens',
        component: 'inputUncached',
        service: 320,
        explanation: 'counted_per_content_block',
        failure: true
      })
    );
  });

  it('fails a reported cost outside rounding', () => {
    let result = compare({
      service: { tokens: agreed, reportedCostUsd: 0.5 + costTolerance(2) * 3 }
    });

    expect(result.status).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({ check: 'reported_cost', failure: true })
    );
  });

  it('explains a computed cost without a catalog offering or across a price change', () => {
    let base = serviceSession({ tokens: agreed });

    let unpriced = compare({
      service: {
        tokens: agreed,
        computedCostUsd: 0.2,
        models: [{ ...base.models[0]!, hasOffering: false }]
      }
    });
    expect(unpriced.status).toBe('pass');
    expect(unpriced.findings).toContainEqual(
      expect.objectContaining({ check: 'computed_cost', explanation: 'no_catalog_offering' })
    );

    let repriced = compare({
      service: {
        tokens: agreed,
        computedCostUsd: 0.4,
        models: [{ ...base.models[0]!, pricePeriods: 2 }]
      }
    });
    expect(repriced.status).toBe('pass');
    expect(repriced.findings).toContainEqual(
      expect.objectContaining({
        check: 'computed_cost',
        explanation: 'price_changed_in_session'
      })
    );

    let wrong = compare({ service: { tokens: agreed, computedCostUsd: 0.4 } });
    expect(wrong.status).toBe('fail');
    expect(wrong.findings).toContainEqual(
      expect.objectContaining({ check: 'computed_cost', explanation: null, failure: true })
    );
  });

  it('fails a model the client used that the service does not have', () => {
    let result = compare({ service: { tokens: agreed, models: [] } });

    expect(result.status).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({ check: 'model_missing', model, failure: true })
    );
  });

  it('falls back to the message floor when the cost-state is behind the transcript', () => {
    let behind = clientState({
      inputTokens: 100,
      outputTokens: 20,
      cacheReadInputTokens: 400
    });

    let above = compare({
      state: behind,
      service: { tokens: { ...agreed, inputUncached: 900 } }
    });
    expect(above).toMatchObject({
      reference: 'messages',
      costStateBehind: true,
      status: 'pass'
    });

    let below = compare({ state: behind, service: { tokens: { ...agreed, output: 29 } } });
    expect(below.status).toBe('fail');
    expect(below.findings).toContainEqual(
      expect.objectContaining({
        check: 'message_floor',
        component: 'output',
        client: 30,
        service: 29
      })
    );
  });

  it('checks only the floor for a session without a cost-state', () => {
    let result = compare({ state: null, service: { tokens: agreed, reportedCostUsd: null } });

    expect(result).toMatchObject({ reference: 'messages', status: 'pass', findings: [] });
  });
});

describe('compareClaudeSession per model', () => {
  let alias = 'claude-opus-4-1';

  let twoIds = () =>
    readCostState([
      costState({
        totalCostUSD: 0.5,
        models: {
          [model]: {
            inputTokens: 100,
            outputTokens: 20,
            cacheReadInputTokens: 400,
            cacheCreationInputTokens: 50,
            costUSD: 0.3
          },
          [alias]: {
            inputTokens: 60,
            outputTokens: 10,
            cacheReadInputTokens: 300,
            costUSD: 0.2
          }
        }
      })
    ]);

  let combined = (overrides: Record<string, unknown> = {}) => {
    let base = serviceSession({ tokens: agreed });

    return {
      tokens: agreed,
      models: [{ ...base.models[0]!, rawIds: [model, alias], ...overrides }]
    };
  };

  it('compares raw ids the service files under one canonical model together', () => {
    let result = compare({ state: twoIds(), service: combined() });

    expect(result.status).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('fails a model whose reported cost differs, though the session total agrees', () => {
    let base = serviceSession({ tokens: agreed });
    let haiku = 'claude-haiku-4-5-20251001';
    let state = readCostState([
      costState({
        totalCostUSD: 0.5,
        models: {
          [model]: {
            inputTokens: 100,
            outputTokens: 20,
            cacheReadInputTokens: 400,
            cacheCreationInputTokens: 50,
            costUSD: 0.4
          },
          [haiku]: {
            inputTokens: 60,
            outputTokens: 10,
            cacheReadInputTokens: 300,
            costUSD: 0.1
          }
        }
      })
    ]);
    let split = (rawId: string, tokens: ReturnType<typeof agreedPart>, cost: number) => ({
      ...base.models[0]!,
      modelId: rawId,
      rawIds: [rawId],
      requests: 1,
      tokens,
      reportedCostUsd: cost,
      computedCostUsd: cost
    });

    let result = compare({
      state,
      service: {
        tokens: agreed,
        models: [
          split(model, agreedPart(100, 20, 400, 50), 0.25),
          split(haiku, agreedPart(60, 10, 300, 0), 0.25)
        ]
      }
    });

    expect(result.status).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        check: 'model_reported_cost',
        model,
        client: 0.4,
        service: 0.25,
        failure: true
      })
    );
    expect(result.findings.some(item => item.check == 'reported_cost')).toBe(false);
  });

  it('explains a model computed cost without a catalog offering', () => {
    let result = compare({
      service: combined({ hasOffering: false, computedCostUsd: null })
    });

    expect(result.status).toBe('pass');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        check: 'model_computed_cost',
        explanation: 'no_catalog_offering',
        failure: false
      })
    );
  });
});

describe('compareCodexSession', () => {
  it('reports token differences without ever failing', () => {
    let rollout = {
      threadId: 'thread-a',
      sessionId: null,
      parentThreadId: null,
      models: ['gpt-5-codex'],
      tokenCountEvents: 2,
      total: {
        input: 1000,
        cachedInput: 400,
        cacheWriteInput: 0,
        output: 100,
        reasoningOutput: 20,
        total: 1100
      },
      span: { firstAt: null, lastAt: null }
    };

    let matching = compareCodexSession({
      rollout,
      service: serviceSession({
        family: 'codex',
        tokens: tokens({ inputUncached: 600, cacheRead: 400, output: 80, reasoning: 20 }),
        computedCostUsd: 0.03
      })
    });
    expect(matching).toEqual({ tokensMatch: true, differences: {}, computedCostUsd: 0.03 });

    let different = compareCodexSession({
      rollout,
      service: serviceSession({
        family: 'codex',
        tokens: tokens({ inputUncached: 650, cacheRead: 400, output: 80, reasoning: 20 })
      })
    });
    expect(different).toMatchObject({
      tokensMatch: false,
      differences: { inputUncached: 50 }
    });
  });
});

describe('compareCostStateWithMessages', () => {
  it('reports whether the cost-state equals the sum over messages, and by how much it differs', () => {
    let messages = readMessageUsage([transcript(3)]);

    expect(compareCostStateWithMessages({ costState: clientState()!, messages })).toEqual({
      equal: true,
      differences: {},
      costStateBehind: false
    });

    expect(
      compareCostStateWithMessages({
        costState: clientState({ inputTokens: 2160 })!,
        messages
      })
    ).toEqual({ equal: false, differences: { inputUncached: 2000 }, costStateBehind: false });

    expect(
      compareCostStateWithMessages({ costState: clientState({ outputTokens: 25 })!, messages })
    ).toMatchObject({ differences: { output: -5 }, costStateBehind: true });
  });
});
