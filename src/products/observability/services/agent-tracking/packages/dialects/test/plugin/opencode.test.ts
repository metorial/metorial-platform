import { describe, expect, it } from 'vitest';
import { opencodePlugin } from '../../src/plugin/opencode';
import { bulkHarness } from '../build';

let observedAt = new Date('2026-06-10T09:30:00.000Z');

let request = (overrides: Record<string, unknown> = {}) => ({
  kind: 'request',
  session_id: 'ses_1',
  message_id: 'msg_1',
  provider: 'openrouter',
  model: 'anthropic/claude-haiku-5.5',
  input_tokens: 4,
  output_tokens: 99,
  reasoning_tokens: 95,
  cache_read_tokens: 0,
  cache_write_tokens: 10685,
  cost_usd: 0.0014330250000000002,
  ...overrides
});

let { check, build } = bulkHarness(opencodePlugin, {
  identityHint: 'desktop|session:ses_1|1',
  client: 'opencode',
  clientVersion: '1.17.18',
  observedAt
});

describe('the OpenCode plugin dialect', () => {
  it('maps a completed assistant message with reasoning, cache writes and its cost', () => {
    let [record, ...rest] = build(request());

    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      type: 'model.request',
      occurred_at: '2026-06-10T09:30:00.000Z',
      source: {
        adapter: 'opencode',
        dialect: 'opencode.plugin.v1',
        channel: 'sse',
        role: 'primary'
      },
      client: { family: 'opencode', version: '1.17.18' },
      ctx: { session_id: 'ses_1' },
      data: {
        outcome: 'ok',
        model: { id: 'anthropic/claude-haiku-5.5', provider: 'other:openrouter' },
        purpose: 'main',
        cost: { amount: '0.001433025', unit: 'usd', basis: 'client_estimate' }
      }
    });
    expect(record!.data.usage).toEqual({
      provenance: 'exact',
      input_uncached: 4,
      cache_read: 0,
      cache_write: 10685,
      output: 99,
      reasoning: 95
    });
    expect(record!.source.fact_key).toBeNull();
  });

  it('normalises first-party providers and works without one', () => {
    let [anthropic] = build(request({ provider: 'anthropic', model: 'claude-sonnet-4-5' }));
    let [unnamed] = build(request({ provider: undefined }));

    expect(anthropic!.data.model).toEqual({ id: 'claude-sonnet-4-5', provider: 'anthropic' });
    expect(unnamed!.data.model).toEqual({ id: 'anthropic/claude-haiku-5.5' });
  });

  it('treats a zero cost as no cost so the catalog prices the message', () => {
    let [free] = build(request({ cost_usd: 0 }));
    let [unknown] = build(request({ cost_usd: undefined }));

    expect(free!.data.cost).toBeUndefined();
    expect(free!.data.usage).toMatchObject({ cache_write: 10685, output: 99 });
    expect(unknown!.data.cost).toBeUndefined();
  });

  it('keeps a long model id whole', () => {
    let model = `vendor/${'m'.repeat(100)}`;

    expect(build(request({ model }))[0]!.data.model).toMatchObject({ id: model });
  });

  it('writes nothing for a message without tokens or cost', () => {
    let empty = request({
      input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0
    });

    expect(build(empty)).toEqual([]);
    expect(build({ ...empty, cost_usd: 0.01 })).toHaveLength(1);
  });

  it('keeps the record id per session and message', () => {
    let first = build(request());
    let again = build(request(), { identityHint: 'desktop|session:ses_1|42' });
    let next = build(request({ message_id: 'msg_2' }));
    let child = build(request({ session_id: 'ses_2' }));

    expect(again[0]!.id).toBe(first[0]!.id);
    expect(next[0]!.id).not.toBe(first[0]!.id);
    expect(child[0]!.id).not.toBe(first[0]!.id);
  });

  it.each([
    ['a missing message id', { message_id: undefined }, 'message_id'],
    ['a provider with a space', { provider: 'open router' }, 'provider'],
    ['a missing model', { model: undefined }, 'model'],
    ['negative tokens', { reasoning_tokens: -1 }, 'reasoning_tokens'],
    ['fractional tokens', { cache_write_tokens: 2.5 }, 'cache_write_tokens'],
    ['a negative cost', { cost_usd: -0.1 }, 'cost_usd'],
    ['a cost as a string', { cost_usd: '0.01' }, 'cost_usd'],
    ['a huge cost', { cost_usd: 1_000_001 }, 'cost_usd'],
    ['another kind', { kind: 'message.updated' }, 'kind']
  ])('rejects %s', (_name, overrides, field) => {
    let result = check(request(overrides));

    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]!.path?.[0]).toBe(field);
  });

  it('ignores fields outside the contract', () => {
    let [record] = build(
      request({ directory: '/home/dev/app', title: 'secret title', parts: ['secret'] })
    );
    let text = JSON.stringify(record);

    expect(text).not.toContain('secret');
    expect(text).not.toContain('/home/dev/app');
  });
});
