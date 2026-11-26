import { describe, expect, it } from 'vitest';
import { groupOf, logRecord } from '@mtsrc/agent-tracking-otlp/test/otlp';
import { groupContext } from '../../src/otlp/common';
import { claudeCodeOtlp } from '../../src/otlp/claudeCode';
import { claudeCodeTranscript } from '../../src/transcript/claudeCode';
import { buildMapped, bulkHarness, policyWith } from '../build';

let observedAt = new Date('2026-06-10T09:30:00.000Z');

let request = (overrides: Record<string, unknown> = {}) => ({
  kind: 'request',
  session_id: 'sess-1',
  message_id: 'msg_01',
  request_id: 'req_01',
  model: 'claude-opus-5-5',
  input_tokens: 2,
  output_tokens: 790,
  cache_read_input_tokens: 14623,
  cache_creation_input_tokens: 20634,
  cache_creation_5m_input_tokens: 0,
  cache_creation_1h_input_tokens: 20634,
  ...overrides
});

let { check, build } = bulkHarness(
  claudeCodeTranscript,
  {
    identityHint: 'desktop|session:sess-1|1',
    client: 'claude-code',
    clientVersion: '2.1.300',
    observedAt,
    policy: policyWith({ sessionContext: true, historyImport: true })
  },
  { lane: 'backfill' }
);

describe('the Claude Code transcript dialect', () => {
  it('maps one API response to a main-thread model request', () => {
    let [record, ...rest] = build(request());

    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      type: 'model.request',
      occurred_at: '2026-06-10T09:30:00.000Z',
      source: {
        adapter: 'claude-code',
        dialect: 'claude-code.transcript.v1',
        channel: 'transcript',
        role: 'primary'
      },
      client: { family: 'claude-code', version: '2.1.300' },
      ctx: { session_id: 'sess-1', request_id: 'req_01' },
      data: {
        outcome: 'ok',
        model: { id: 'claude-opus-5-5' },
        usage: {
          provenance: 'exact',
          input_uncached: 2,
          cache_read: 14623,
          cache_write: 20634,
          cache_write_5m: 0,
          cache_write_1h: 20634,
          output: 790
        },
        purpose: 'main'
      },
      quality: { time_source: 'agent_observed' }
    });
    expect(record!.data.cost).toBeUndefined();
  });

  it('uses the fact key of the OTel api_request for the same request', () => {
    let log = logRecord({
      'event.name': 'api_request',
      'session.id': 'sess-1',
      request_id: 'req_01',
      model: 'claude-opus-5-5',
      input_tokens: 2,
      output_tokens: 790
    });
    let [otel] = claudeCodeOtlp.mapLog!(
      groupContext('logs', groupOf([], { 'service.name': 'claude-code' })),
      log
    ).map(entry => buildMapped(entry));
    let [transcript] = build(request());

    expect(transcript!.source.fact_key).toBeTruthy();
    expect(transcript!.source.fact_key).toBe(otel!.source.fact_key);
    expect(transcript!.ctx.session_key).toBe(otel!.ctx.session_key);
  });

  it('has no fact key without a request id', () => {
    let [record] = build(request({ request_id: undefined }));

    expect(record!.source.fact_key).toBeNull();
    expect(record!.data.usage).toMatchObject({ output: 790 });
  });

  it('keeps the record id across re-imports and batches', () => {
    let first = build(request());
    let again = build(request(), { identityHint: 'desktop|session:sess-1|99' });
    let other = build(request({ message_id: 'msg_02' }));

    expect(again[0]!.id).toBe(first[0]!.id);
    expect(other[0]!.id).not.toBe(first[0]!.id);
  });

  it('leaves out cache fields the line did not have', () => {
    let [record] = build(
      request({
        cache_read_input_tokens: undefined,
        cache_creation_input_tokens: undefined,
        cache_creation_5m_input_tokens: undefined,
        cache_creation_1h_input_tokens: undefined
      })
    );

    expect(record!.data.usage).toEqual({
      provenance: 'exact',
      input_uncached: 2,
      output: 790
    });
  });

  it.each([
    ['a missing message id', { message_id: undefined }, 'message_id'],
    ['a synthetic model', { model: '<synthetic>' }, 'model'],
    ['a model with a space', { model: 'claude opus' }, 'model'],
    ['missing output tokens', { output_tokens: undefined }, 'output_tokens'],
    ['negative tokens', { input_tokens: -1 }, 'input_tokens'],
    ['fractional tokens', { cache_read_input_tokens: 1.5 }, 'cache_read_input_tokens'],
    ['too many tokens', { output_tokens: 1_000_000_001 }, 'output_tokens'],
    ['tokens as a decimal string', { input_tokens: '2' }, 'input_tokens'],
    ['tokens in exponent notation', { output_tokens: '1e3' }, 'output_tokens'],
    ['tokens as a hex string', { cache_read_input_tokens: '0x10' }, 'cache_read_input_tokens'],
    ['another kind', { kind: 'cost_state' }, 'kind'],
    ['a long session id', { session_id: 's'.repeat(257) }, 'session_id'],
    ['a request id with a space', { request_id: 'req 01' }, 'request_id']
  ])('rejects %s', (_name, overrides, field) => {
    let result = check(request(overrides));

    expect(result.success).toBe(false);
    expect(!result.success && result.errors[0]!.path?.[0]).toBe(field);
  });

  it('ignores fields outside the contract', () => {
    let [record] = build(request({ content: 'secret text', cwd: '/home/dev/project' }));

    expect(JSON.stringify(record)).not.toContain('secret text');
    expect(JSON.stringify(record)).not.toContain('/home/dev/project');
  });
});
