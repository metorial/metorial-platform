import type { ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { pruneOldToolResults } from '../../../lib/open-harness/lib/pruneToolResults';
import { defaultEstimateTokens } from '../../../lib/open-harness/lib/utils';
import { explorerShouldCompact } from './compaction';

let toolResult = (value: string): ModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: 'call_1',
      toolName: 'search',
      output: { type: 'text', value }
    }
  ]
});

describe('explorer compaction', () => {
  it('compacts when history is large even if the session has no prior usage', () => {
    let payload = 'x'.repeat(80_000);
    let messages = [toolResult(payload), { role: 'user' as const, content: 'continue' }];

    expect(
      explorerShouldCompact({
        lastInputTokens: 0,
        contextWindow: 20_000,
        reservedTokens: 8_000,
        messages,
        turnNumber: 1
      })
    ).toBe(true);
    expect(defaultEstimateTokens(messages)).toBeGreaterThan(8_000);
  });

  it('replaces older tool outputs and leaves the recent tail intact', () => {
    let payload = 'x'.repeat(80_000);
    let messages = [toolResult(payload), { role: 'user' as const, content: 'continue' }];
    let pruned = pruneOldToolResults(messages, {
      protectedTokens: 10,
      minSavings: 1_000,
      inPlace: true
    });

    expect(pruned.tokensSaved).toBeGreaterThan(1_000);
    expect(JSON.stringify(messages[0])).toContain('[pruned]');
    expect(JSON.stringify(messages[0])).not.toContain(payload);
    expect(messages[1]).toEqual({ role: 'user', content: 'continue' });
  });

  it('keeps tool results when the whole conversation fits in the protected tail', () => {
    let payload = 'x'.repeat(80_000);
    let messages = [toolResult(payload), { role: 'user' as const, content: 'continue' }];
    let pruned = pruneOldToolResults(messages, {
      protectedTokens: 100_000,
      minSavings: 1,
      inPlace: true
    });

    expect(pruned.tokensSaved).toBe(0);
    expect(JSON.stringify(messages[0])).toContain(payload);
  });
});
