import { describe, expect, it } from 'vitest';
import { codexAsServiceTokens, readCodexRollout } from '../../src/reconcile/codex';
import { secretPath, secretText } from './fixtures';

let tokenCount = (at: string, total: Record<string, number> | null) => ({
  timestamp: at,
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: total ? { total_token_usage: total, last_token_usage: total } : null
  }
});

let usage = (input: number, cached: number, output: number, reasoning: number) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output
});

describe('readCodexRollout', () => {
  it('reads the thread from the first session_meta and its running total from the last token_count', () => {
    let rollout = readCodexRollout([
      {
        timestamp: '2026-11-05T10:00:00.000Z',
        type: 'session_meta',
        payload: { id: 'thread-a', session_id: 'session-a', cwd: secretPath }
      },
      {
        timestamp: '2026-11-05T10:00:01.000Z',
        type: 'turn_context',
        payload: { model: 'gpt-5-codex', cwd: secretPath }
      },
      {
        timestamp: '2026-11-05T10:00:02.000Z',
        type: 'response_item',
        payload: { type: 'message', content: secretText }
      },
      tokenCount('2026-11-05T10:00:03.000Z', usage(1000, 600, 200, 50)),
      tokenCount('2026-11-05T10:00:04.000Z', null),
      tokenCount('2026-11-05T10:00:05.000Z', usage(1800, 1200, 300, 80)),
      {
        timestamp: '2026-11-05T10:00:06.000Z',
        type: 'session_meta',
        payload: { id: 'thread-forked', parent_thread_id: 'thread-a' }
      }
    ]);

    expect(rollout).toMatchObject({
      threadId: 'thread-a',
      sessionId: 'session-a',
      parentThreadId: null,
      models: ['gpt-5-codex'],
      tokenCountEvents: 3,
      total: {
        input: 1800,
        cachedInput: 1200,
        cacheWriteInput: 0,
        output: 300,
        reasoningOutput: 80,
        total: 2100
      }
    });
    expect(rollout.span.lastAt).toEqual(new Date('2026-11-05T10:00:06.000Z'));
    expect(JSON.stringify(rollout)).not.toContain(secretText);
    expect(JSON.stringify(rollout)).not.toContain(secretPath);
  });

  it('splits cached input and reasoning out the way the service stores them', () => {
    expect(
      codexAsServiceTokens({
        input: 1800,
        cachedInput: 1200,
        cacheWriteInput: 10,
        output: 300,
        reasoningOutput: 80,
        total: 2100
      })
    ).toEqual({
      inputUncached: 600,
      output: 220,
      cacheRead: 1200,
      cacheWrite: 10,
      reasoning: 80
    });
  });
});
