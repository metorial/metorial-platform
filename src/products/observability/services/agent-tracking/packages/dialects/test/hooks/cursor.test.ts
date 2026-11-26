import { describe, expect, it } from 'vitest';
import { cursorHooks } from '../../src/hooks/cursor';
import { bulkHarness } from '../build';

let observedAt = new Date('2026-06-10T09:30:00.000Z');

let request = (overrides: Record<string, unknown> = {}) => ({
  kind: 'request',
  session_id: 'conv-1',
  generation_id: 'gen-1',
  model: 'composer-2.5',
  input_tokens: 40000,
  output_tokens: 200,
  cache_read_tokens: 30000,
  cache_write_tokens: 1000,
  ...overrides
});

let { check, build } = bulkHarness(cursorHooks, {
  identityHint: 'desktop|session:conv-1|1',
  client: 'cursor',
  clientVersion: '2026.11.22-abc1234',
  observedAt
});

describe('the Cursor hooks dialect', () => {
  it('maps a stop hook to a completed turn with aggregate usage without the cache in the input', () => {
    let [record, ...rest] = build(request());

    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      type: 'turn.completed',
      occurred_at: '2026-06-10T09:30:00.000Z',
      source: {
        adapter: 'cursor',
        dialect: 'cursor.hooks.v1',
        channel: 'hook',
        role: 'primary'
      },
      client: { family: 'cursor', version: '2026.11.22-abc1234' },
      ctx: { session_id: 'conv-1' },
      quality: { derived: ['usage.input_uncached'] },
      data: {
        outcome: 'ok',
        model: { id: 'composer-2.5' },
        usage: {
          provenance: 'aggregate',
          input_uncached: 9000,
          cache_read: 30000,
          cache_write: 1000,
          output: 200
        }
      }
    });
    expect(record!.data.cost).toBeUndefined();
    expect(record!.data.purpose).toBeUndefined();
    expect(record!.quality.warnings).not.toContain('usage_negative:input_uncached');
    expect(record!.source.fact_key).toBeNull();
  });

  it('floors the uncached input at zero like Cursor does and warns about it', () => {
    let [record] = build(request({ input_tokens: 100, cache_read_tokens: 150 }));

    expect(record!.data.usage).toMatchObject({ input_uncached: 0, cache_read: 150 });
    expect(record!.quality.warnings).toContain('usage_negative:input_uncached');
  });

  it('reads usage without the cache fields', () => {
    let [record] = build(
      request({ cache_read_tokens: undefined, cache_write_tokens: undefined })
    );

    expect(record!.data.usage).toEqual({
      provenance: 'aggregate',
      input_uncached: 40000,
      output: 200
    });
  });

  it('keeps a long model id whole', () => {
    let model = `openrouter/${'m'.repeat(100)}`;

    expect(build(request({ model }))[0]!.data.model).toEqual({ id: model });
  });

  it('writes nothing for a turn without tokens', () => {
    expect(
      build(
        request({
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0
        })
      )
    ).toEqual([]);
  });

  it('keeps one record per generation whichever stop event sent it', () => {
    let first = build(request());
    let again = build(request(), {
      identityHint: 'desktop|session:conv-1|7'
    });
    let next = build(request({ generation_id: 'gen-2' }));

    expect(again[0]!.id).toBe(first[0]!.id);
    expect(next[0]!.id).not.toBe(first[0]!.id);
  });

  it.each([
    ['a missing generation id', { generation_id: undefined }, 'generation_id'],
    ['a missing model', { model: undefined }, 'model'],
    ['a model with a space', { model: 'composer 2' }, 'model'],
    ['a model over 128 characters', { model: 'm'.repeat(129) }, 'model'],
    ['missing input tokens', { input_tokens: undefined }, 'input_tokens'],
    ['negative tokens', { output_tokens: -1 }, 'output_tokens'],
    ['fractional tokens', { cache_read_tokens: 1.5 }, 'cache_read_tokens'],
    ['tokens as a string', { cache_write_tokens: '10' }, 'cache_write_tokens'],
    ['too many tokens', { input_tokens: 1_000_000_001 }, 'input_tokens'],
    ['another kind', { kind: 'session_end' }, 'kind'],
    ['a long session id', { session_id: 's'.repeat(257) }, 'session_id']
  ])('rejects %s', (_name, overrides, field) => {
    let result = check(request(overrides));

    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]!.path?.[0]).toBe(field);
  });

  it('ignores fields outside the contract', () => {
    let [record] = build(
      request({
        user_email: 'dev@example.com',
        text: 'secret answer',
        workspace_roots: ['/home/dev/project']
      })
    );
    let text = JSON.stringify(record);

    expect(text).not.toContain('dev@example.com');
    expect(text).not.toContain('secret answer');
    expect(text).not.toContain('/home/dev/project');
  });
});
