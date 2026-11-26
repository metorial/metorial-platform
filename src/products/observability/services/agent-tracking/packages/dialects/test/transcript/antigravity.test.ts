import { describe, expect, it } from 'vitest';
import { antigravityTranscript } from '../../src/transcript/antigravity';
import { bulkHarness } from '../build';

let observedAt = new Date('2026-06-10T09:30:00.000Z');

let request = (overrides: Record<string, unknown> = {}) => ({
  kind: 'request',
  session_id: 'conv-1',
  step_index: 4,
  model: 'gemini-4-hydrogen',
  input_tokens: 2500,
  cache_read_tokens: 11000,
  output_tokens: 90,
  ...overrides
});

let { check, build } = bulkHarness(antigravityTranscript, {
  identityHint: 'desktop|session:conv-1|1',
  client: 'antigravity',
  clientVersion: '1.5.17',
  observedAt
});

describe('the Antigravity transcript dialect', () => {
  it('maps a planner response to a main-thread model request with uncached input', () => {
    let [record, ...rest] = build(request());

    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      type: 'model.request',
      occurred_at: '2026-06-10T09:30:00.000Z',
      source: {
        adapter: 'antigravity',
        dialect: 'antigravity.transcript.v1',
        channel: 'transcript',
        role: 'primary'
      },
      client: { family: 'antigravity', version: '1.5.17' },
      ctx: { session_id: 'conv-1' },
      data: { outcome: 'ok', model: { id: 'gemini-4-hydrogen' }, purpose: 'main' }
    });
    expect(record!.data.usage).toEqual({
      provenance: 'exact',
      input_uncached: 2500,
      cache_read: 11000,
      output: 90
    });
    expect(record!.data.cost).toBeUndefined();
    expect(record!.source.fact_key).toBeNull();
  });

  it('takes the effort from the model suffix and keeps the model id as sent', () => {
    let [high] = build(request({ model: 'gemini-4-hydrogen-high' }));
    let [low] = build(request({ model: 'gemini-4-hydrogen-low' }));
    let [medium] = build(request({ model: 'gemini-4-hydrogen-medium' }));
    let [plain] = build(request());

    expect(high!.data).toMatchObject({
      model: { id: 'gemini-4-hydrogen-high' },
      effort: 'high'
    });
    expect(low!.data.effort).toBe('low');
    expect(medium!.data.effort).toBe('medium');
    expect(plain!.data.effort).toBeUndefined();
    expect(build(request({ model: 'gemini-highway' }))[0]!.data.effort).toBeUndefined();
  });

  it('reads usage without cache reads', () => {
    let [record] = build(request({ cache_read_tokens: undefined }));

    expect(record!.data.usage).toEqual({
      provenance: 'exact',
      input_uncached: 2500,
      output: 90
    });
  });

  it('writes nothing for a step without tokens', () => {
    expect(
      build(request({ input_tokens: 0, cache_read_tokens: 0, output_tokens: 0 }))
    ).toEqual([]);
  });

  it('keeps the record id per conversation and step', () => {
    let first = build(request());
    let again = build(request(), { identityHint: 'desktop|session:conv-1|9' });
    let next = build(request({ step_index: 6 }));
    let other = build(request({ session_id: 'conv-2' }));

    expect(again[0]!.id).toBe(first[0]!.id);
    expect(next[0]!.id).not.toBe(first[0]!.id);
    expect(other[0]!.id).not.toBe(first[0]!.id);
    expect(other[0]!.ctx.session_key).not.toBe(first[0]!.ctx.session_key);
  });

  it.each([
    ['a missing step index', { step_index: undefined }, 'step_index'],
    ['a step index as a string', { step_index: '4' }, 'step_index'],
    ['a fractional step index', { step_index: 4.5 }, 'step_index'],
    ['a missing model', { model: undefined }, 'model'],
    ['missing output tokens', { output_tokens: undefined }, 'output_tokens'],
    ['negative tokens', { input_tokens: -1 }, 'input_tokens'],
    ['tokens in exponent notation', { cache_read_tokens: '1e3' }, 'cache_read_tokens'],
    ['another kind', { kind: 'PLANNER_RESPONSE' }, 'kind']
  ])('rejects %s', (_name, overrides, field) => {
    let result = check(request(overrides));

    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]!.path?.[0]).toBe(field);
  });

  it('ignores fields outside the contract', () => {
    let [record] = build(
      request({ content: 'secret answer', thinking: 'secret thought', cwd: '/home/dev/app' })
    );
    let text = JSON.stringify(record);

    expect(text).not.toContain('secret');
    expect(text).not.toContain('/home/dev/app');
  });
});
