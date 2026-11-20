import { describe, expect, it } from 'vitest';
import { parseJsonLines, readCostState, readMessageUsage } from '../../src/reconcile/claude';
import { assistantLines, costState, tokens, usage, userLine } from './fixtures';

describe('parseJsonLines', () => {
  it('skips blank lines and counts lines that are not JSON', () => {
    let parsed = parseJsonLines('{"type":"a"}\n\n{not json\n{"type":"b"}\n');

    expect(parsed.entries).toEqual([{ type: 'a' }, { type: 'b' }]);
    expect(parsed.invalidLines).toBe(1);
  });
});

describe('readCostState', () => {
  it('takes the last entry and maps tokens and cost per model', () => {
    let state = readCostState([
      costState({
        totalCostUSD: 0.1,
        models: { 'claude-opus-4-1-20250805': { inputTokens: 1 } }
      }),
      userLine('2026-11-01T10:00:00.000Z'),
      costState({
        totalCostUSD: 0.75,
        hasUnknownModelCost: true,
        models: {
          'claude-opus-4-1-20250805': {
            inputTokens: 120,
            outputTokens: 40,
            thinkingTokens: 7,
            cacheReadInputTokens: 900,
            cacheCreationInputTokens: 300,
            cacheCreationEphemeral5mInputTokens: 200,
            cacheCreationEphemeral1hInputTokens: 100,
            webSearchRequests: 2,
            costUSD: 0.7
          },
          'claude-haiku-4-5-20251001': { inputTokens: 10, outputTokens: 5, costUSD: 0.05 }
        }
      })
    ]);

    expect(state).toMatchObject({
      totalCostUsd: 0.75,
      hasUnknownModelCost: true,
      entries: 2
    });
    expect(state!.models).toEqual([
      {
        model: 'claude-haiku-4-5-20251001',
        tokens: tokens({ inputUncached: 10, output: 5 }),
        costUsd: 0.05
      },
      {
        model: 'claude-opus-4-1-20250805',
        tokens: tokens({
          inputUncached: 120,
          output: 40,
          reasoning: 7,
          cacheRead: 900,
          cacheWrite: 300
        }),
        costUsd: 0.7
      }
    ]);
  });

  it('returns null for a session that saved none', () => {
    expect(readCostState([userLine('2026-11-01T10:00:00.000Z')])).toBeNull();
  });
});

describe('readMessageUsage', () => {
  it('counts each message once although every content block repeats its usage', () => {
    let first = usage({ input: 100, output: 20, cacheRead: 50, cacheWrite: 10, thinking: 5 });
    let second = usage({ input: 30, output: 6, iterations: true });

    let read = readMessageUsage([
      [
        userLine('2026-11-01T10:00:00.000Z'),
        ...assistantLines({
          messageId: 'msg_1',
          blocks: 3,
          at: '2026-11-01T10:00:01.000Z',
          usage: first
        }),
        ...assistantLines({
          messageId: 'msg_2',
          blocks: 2,
          at: '2026-11-01T10:05:00.000Z',
          usage: second
        })
      ]
    ]);

    expect(read.messages).toBe(2);
    expect(read.tokens).toEqual(
      tokens({ inputUncached: 130, output: 26, cacheRead: 50, cacheWrite: 10, reasoning: 5 })
    );
    expect(read.perLine).toEqual(
      tokens({ inputUncached: 360, output: 72, cacheRead: 150, cacheWrite: 30, reasoning: 15 })
    );
    expect(read.withIterations).toEqual(
      tokens({ inputUncached: 420, output: 84, cacheRead: 150, cacheWrite: 30, reasoning: 15 })
    );
    expect(read.span).toEqual({
      firstAt: new Date('2026-11-01T10:00:00.000Z'),
      lastAt: new Date('2026-11-01T10:05:00.000Z')
    });
  });

  it('includes subagent files and counts a message copied into a fork once', () => {
    let shared = usage({ input: 10, output: 1 });

    let read = readMessageUsage([
      assistantLines({
        messageId: 'msg_main',
        blocks: 1,
        at: '2026-11-01T10:00:00.000Z',
        usage: shared
      }),
      [
        ...assistantLines({
          messageId: 'msg_main',
          blocks: 1,
          at: '2026-11-01T10:00:00.000Z',
          usage: shared
        }),
        ...assistantLines({
          messageId: 'msg_sub',
          model: 'claude-haiku-4-5-20251001',
          blocks: 2,
          at: '2026-11-01T10:01:00.000Z',
          usage: usage({ input: 4, output: 2 })
        })
      ]
    ]);

    expect(read.files).toBe(2);
    expect(read.messages).toBe(2);
    expect(read.models).toEqual([
      {
        model: 'claude-haiku-4-5-20251001',
        messages: 1,
        tokens: tokens({ inputUncached: 4, output: 2 })
      },
      {
        model: 'claude-opus-4-1-20250805',
        messages: 1,
        tokens: tokens({ inputUncached: 10, output: 1 })
      }
    ]);
  });

  it('leaves out synthetic messages the client writes without a request', () => {
    let read = readMessageUsage([
      assistantLines({
        messageId: 'msg_synthetic',
        model: '<synthetic>',
        blocks: 1,
        at: '2026-11-01T10:00:00.000Z',
        usage: usage({ input: 0, output: 0 })
      })
    ]);

    expect(read.messages).toBe(0);
    expect(read.models).toEqual([]);
  });
});
