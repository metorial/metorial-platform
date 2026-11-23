import { describe, expect, it } from 'vitest';
import { datasets } from '../src/catalog';
import { readPath } from '../src/lib/rows';

// A Claude Code request record as stored, after `storedKey`; Codex adds `ttftMs`.
let stored = {
  data: {
    effort: 'max',
    speed: 'fast',
    stopReason: 'end_turn',
    durationMs: 4000,
    ttftMs: 800,
    billing: { mode: 'included', plan: 'max', seat: 'premium' }
  }
};

describe('request fields', () => {
  it('read the values the dialects store', () => {
    let expected: Record<string, unknown> = {
      'reasoning.effort': 'max',
      speed: 'fast',
      finish_reason: 'end_turn',
      latency: 4000,
      ttft: 800,
      'billing.plan': 'max',
      'billing.seat': 'premium'
    };

    for (let [name, value] of Object.entries(expected)) {
      let source = datasets.requests.fields[name]!.source;

      expect(source.kind, name).toBe('stored');
      expect(readPath(stored, (source as { path: string }).path), name).toBe(value);
    }
  });
});
