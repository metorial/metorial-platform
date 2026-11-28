import { describe, expect, it } from 'vitest';
import { codexTranscript } from '../../src/transcript/codex';
import { bulkHarness, policyWith } from '../build';

let observedAt = new Date('2026-06-10T09:30:00.000Z');

let request = (overrides: Record<string, unknown> = {}) => ({
  kind: 'request',
  session_id: 'thread-1',
  cumulative_total_tokens: 70030,
  model: 'gpt-6-luna',
  input_tokens: 39000,
  cached_input_tokens: 30000,
  cache_write_input_tokens: 0,
  output_tokens: 767,
  reasoning_output_tokens: 300,
  total_tokens: 39767,
  ...overrides
});

let { check, build } = bulkHarness(
  codexTranscript,
  {
    identityHint: 'desktop|session:thread-1|1',
    client: 'codex',
    clientVersion: '0.170.0',
    observedAt,
    policy: policyWith({ sessionContext: true, historyImport: true })
  },
  { lane: 'backfill' }
);

describe('the Codex rollout dialect', () => {
  it('maps a token_count to a model request with cache and reasoning tokens', () => {
    let [record, ...rest] = build(request());

    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      type: 'model.request',
      occurred_at: '2026-06-10T09:30:00.000Z',
      source: {
        adapter: 'codex',
        dialect: 'codex.transcript.v1',
        channel: 'transcript',
        role: 'primary'
      },
      client: { family: 'codex', version: '0.170.0' },
      ctx: { session_id: 'thread-1' },
      data: {
        outcome: 'ok',
        model: { id: 'gpt-6-luna' },
        usage: {
          provenance: 'derived',
          input_uncached: 9000,
          cache_read: 30000,
          cache_write: 0,
          output: 467,
          reasoning: 300,
          total_reported: 39767
        }
      }
    });
    expect(record!.data.usage).not.toHaveProperty('unaccounted');
    expect(record!.data.cost).toBeUndefined();
    expect(record!.source.fact_key).toBeNull();
  });

  it('gives a repeated token_count the id of the first one', () => {
    let first = build(request());
    let repeated = build(request(), { identityHint: 'desktop|session:thread-1|2' });
    let next = build(
      request({ cumulative_total_tokens: 110170, input_tokens: 40000, total_tokens: 40140 })
    );

    expect(repeated[0]!.id).toBe(first[0]!.id);
    expect(next[0]!.id).not.toBe(first[0]!.id);
  });

  it('writes nothing for the empty token_count Codex logs after a compaction', () => {
    let compaction = request({
      input_tokens: 0,
      cached_input_tokens: 0,
      cache_write_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 245_000
    });

    expect(build(compaction)).toEqual([]);
    expect(
      build(request({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 1 }))
    ).toHaveLength(1);
  });

  it('keeps threads apart', () => {
    let [main] = build(request());
    let [subagent] = build(request({ session_id: 'thread-2' }));

    expect(subagent!.id).not.toBe(main!.id);
    expect(subagent!.ctx.session_key).not.toBe(main!.ctx.session_key);
  });

  it('reads usage without the optional token fields', () => {
    let [record] = build(
      request({
        cached_input_tokens: undefined,
        cache_write_input_tokens: undefined,
        reasoning_output_tokens: undefined,
        total_tokens: undefined
      })
    );

    expect(record!.data.usage).toEqual({
      provenance: 'derived',
      input_uncached: 39000,
      output: 767
    });
  });

  it.each([
    [
      'a missing running total',
      { cumulative_total_tokens: undefined },
      'cumulative_total_tokens'
    ],
    ['a missing model', { model: undefined }, 'model'],
    ['negative tokens', { output_tokens: -5 }, 'output_tokens'],
    ['fractional tokens', { reasoning_output_tokens: 0.5 }, 'reasoning_output_tokens'],
    ['another kind', { kind: 'turn' }, 'kind'],
    [
      'a running total as a string',
      { cumulative_total_tokens: '70030' },
      'cumulative_total_tokens'
    ],
    ['tokens in exponent notation', { input_tokens: '1e3' }, 'input_tokens'],
    ['tokens as a hex string', { cached_input_tokens: '0x10' }, 'cached_input_tokens']
  ])('rejects %s', (_name, overrides, field) => {
    let result = check(request(overrides));

    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]!.path?.[0]).toBe(field);
  });
});
