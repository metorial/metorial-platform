import { describe, expect, it } from 'vitest';
import { buildMapped } from '../../../test/build';
import { groupOf, logRecord, metricPoint, nanosOf, spanOf } from '../../../test/otlp';
import { genAiOtlp, genAiOtlpId } from '../genai';
import { groupContext } from '../common';

let resource = { 'service.name': 'my-agent', 'service.version': '3.1.4' };

let ctx = (signal: 'logs' | 'metrics' | 'traces', first?: unknown) =>
  groupContext(signal, groupOf(first ? [first as never] : [], resource));

let mapSpanOne = (
  name: string,
  attributes: Record<string, never | string | number | boolean>,
  overrides = {}
) => {
  let span = spanOf(name, attributes as never, overrides);
  let mapped = genAiOtlp.mapSpan!(ctx('traces', span), span);

  expect(mapped).toHaveLength(1);

  return mapped[0]!;
};

describe('genAiOtlp.matches', () => {
  it.each([
    ['traces', 'chat gpt-4o', true],
    ['traces', 'chat', true],
    ['traces', 'execute_tool search', true],
    ['traces', 'invoke_agent planner', true],
    ['traces', 'chatty', false],
    ['traces', 'GET /x', false],
    ['logs', 'gen_ai.client.inference.operation.details', true],
    ['logs', 'other', false],
    ['metrics', 'gen_ai.client.token.usage', true],
    ['metrics', 'http.server.duration', false]
  ] as const)('%s sample %j -> %s', (signal, sample, expected) => {
    let context = { ...ctx(signal), sampleName: sample };

    expect(genAiOtlp.matches(context)).toBe(expected);
  });

  it('does not match without a sample name', () => {
    expect(genAiOtlp.matches(ctx('traces'))).toBe(false);
  });
});

describe('genAiOtlp.mapSpan model requests', () => {
  let attributes = {
    'gen_ai.operation.name': 'chat',
    'gen_ai.provider.name': 'anthropic',
    'gen_ai.request.model': 'claude-sonnet-4-5',
    'gen_ai.response.model': 'claude-sonnet-4-5-20260101',
    'gen_ai.response.id': 'resp-1',
    'gen_ai.conversation.id': 'conv-1',
    'gen_ai.usage.input_tokens': 1000,
    'gen_ai.usage.cache_read.input_tokens': 400,
    'gen_ai.usage.cache_creation.input_tokens': 100,
    'gen_ai.usage.output_tokens': 300,
    'gen_ai.usage.reasoning.output_tokens': 50,
    'gen_ai.prompt': 'SENTINEL-PROMPT',
    'gen_ai.completion': 'SENTINEL-COMPLETION'
  };

  it('maps token usage with derived components', () => {
    let { source, draft } = mapSpanOne('chat claude-sonnet-4-5', attributes);

    expect(source).toEqual({
      adapter: 'generic',
      dialect: genAiOtlpId,
      channel: 'otlp.traces'
    });
    expect(draft).toMatchObject({
      type: 'model.request',
      signalName: 'chat',
      durationMs: 2000,
      client: { family: 'generic', version: '3.1.4' },
      ctx: {
        sessionId: 'conv-1',
        requestId: 'resp-1',
        trace: { traceId: '0af7651916cd43dd8448eb211c80319c', spanId: 'b7ad6b7169203331' }
      },
      derived: ['usage.input_uncached', 'usage.output'],
      data: {
        outcome: 'ok',
        model: { id: 'claude-sonnet-4-5-20260101', provider: 'anthropic' },
        duration_ms: 2000,
        usage: {
          provenance: 'derived',
          input_uncached: 600,
          cache_read: 400,
          cache_write: 100,
          output: 250,
          reasoning: 50
        }
      }
    });
  });

  it('never copies prompt or completion attributes into the draft', () => {
    let { draft } = mapSpanOne('chat', attributes);

    expect(JSON.stringify({ ...draft, identity: '' })).not.toContain('SENTINEL');
    expect(draft.content).toBeUndefined();
  });

  it('infers the operation from the span name', () => {
    expect(mapSpanOne('chat gpt-4o', {}).draft.type).toBe('model.request');
    expect(mapSpanOne('generate_content gemini', {}).draft.type).toBe('model.request');
    expect(mapSpanOne('text_completion x', {}).draft.type).toBe('model.request');
  });

  it('maps provider aliases and falls back to gen_ai.system', () => {
    let model = { 'gen_ai.request.model': 'm' };

    expect(
      mapSpanOne('chat', { ...model, 'gen_ai.system': 'aws.bedrock' }).draft.data?.['model']
    ).toEqual({ id: 'm', provider: 'bedrock' });
    expect(
      mapSpanOne('chat', { ...model, 'gen_ai.provider.name': 'Weird Co' }).draft.data?.[
        'model'
      ]
    ).toEqual({ id: 'm', provider: 'other:weird_co' });
  });

  it('reports github requests as included in the subscription', () => {
    let model = { 'gen_ai.request.model': 'gpt-4o' };

    expect(
      mapSpanOne('chat', { ...model, 'gen_ai.provider.name': 'github' }).draft.data
    ).toMatchObject({
      model: { id: 'gpt-4o', provider: 'github' },
      billing: { mode: 'included' }
    });
    expect(
      mapSpanOne('chat', { ...model, 'gen_ai.system': 'GitHub' }).draft.data?.['billing']
    ).toEqual({ mode: 'included' });
  });

  it('says nothing about billing for other providers', () => {
    for (let provider of ['openai', 'anthropic', 'aws.bedrock', 'Weird Co']) {
      expect(
        mapSpanOne('chat', { 'gen_ai.provider.name': provider }).draft.data
      ).not.toHaveProperty('billing');
    }

    expect(mapSpanOne('chat', {}).draft.data).not.toHaveProperty('billing');
  });

  it('marks failed spans with a classified error', () => {
    let status = mapSpanOne('chat', {}, { statusCode: 2 }).draft.data;
    let timeout = mapSpanOne('chat', { 'error.type': 'RequestTimeoutError' }).draft.data;
    let rate = mapSpanOne('chat', { 'error.type': 'rate_limit_exceeded' }).draft.data;
    let auth = mapSpanOne('chat', { 'error.type': 'AuthenticationError' }).draft.data;
    let network = mapSpanOne('chat', { 'error.type': 'ConnectionError' }).draft.data;

    expect(status).toMatchObject({ outcome: 'error', error: { class: 'unknown' } });
    expect(timeout).toMatchObject({
      outcome: 'error',
      error: { class: 'timeout', retryable: true }
    });
    expect(rate).toMatchObject({ error: { class: 'rate_limit' } });
    expect(auth).toMatchObject({ error: { class: 'auth' } });
    expect(network).toMatchObject({ error: { class: 'network' } });
  });

  it('omits usage when no token attributes exist', () => {
    expect(mapSpanOne('chat', {}).draft.data).not.toHaveProperty('usage');
  });

  it('warns about a negative derived remainder', () => {
    let { draft } = mapSpanOne('chat', {
      'gen_ai.usage.input_tokens': 10,
      'gen_ai.usage.cache_read.input_tokens': 50
    });

    expect(draft.warnings).toEqual(['usage_negative:input_uncached']);
  });

  it('has no duration when the end precedes the start', () => {
    let { draft } = mapSpanOne(
      'chat',
      {},
      { startNs: nanosOf('2026-06-15T12:00:00.000Z'), endNs: 5n }
    );

    expect(draft.durationMs).toBeUndefined();
  });
});

describe('genAiOtlp.mapSpan other operations', () => {
  it('maps tool execution with a fact key', () => {
    let { draft } = mapSpanOne('execute_tool search', {
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': 'Bash',
      'gen_ai.tool.call.id': 'call-1',
      'gen_ai.tool.call.arguments': 'SENTINEL-ARGS',
      'gen_ai.tool.call.result': 'SENTINEL-RESULT'
    });

    expect(draft).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:call-1',
      ctx: { toolCallId: 'call-1' },
      data: { tool: { name: 'Bash', kind: 'shell', class: 'shell' }, outcome: 'ok' }
    });
    expect(JSON.stringify({ ...draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('has a null fact key and no tool without ids or names', () => {
    let { draft } = mapSpanOne('execute_tool x', {});

    expect(draft.factKey).toBeNull();
    expect(draft.data).not.toHaveProperty('tool');
  });

  it('maps agent invocations', () => {
    expect(
      mapSpanOne('invoke_agent planner', { 'gen_ai.agent.name': 'planner' }).draft
    ).toMatchObject({ type: 'agent.end', data: { status: 'completed', name: 'planner' } });
    expect(mapSpanOne('invoke_agent planner', {}, { statusCode: 2 }).draft.data).toMatchObject(
      {
        status: 'failed'
      }
    );
  });

  it('keeps unknown operations as diagnostics', () => {
    expect(mapSpanOne('embeddings text-embedding', {}).draft).toMatchObject({
      type: 'unmapped',
      signalName: 'embeddings',
      data: { native_name: 'embeddings', category: 'diagnostic' }
    });
  });

  it('is deterministic per span identity', () => {
    let a = mapSpanOne('chat', {});
    let b = mapSpanOne('chat', {});
    let c = mapSpanOne('chat', {}, { spanId: 'ffffffffffffffff' });

    expect(a.draft.identity).toBe(b.draft.identity);
    expect(a.draft.identity).not.toBe(c.draft.identity);
  });

  it('builds records for every span shape', () => {
    for (let name of ['chat', 'execute_tool x', 'invoke_agent y', 'retrieval z']) {
      let record = buildMapped(mapSpanOne(name, {}), { route: 'otlp_http' });

      expect(record.source.channel).toBe('otlp.traces');
    }
  });
});

describe('genAiOtlp.mapMetric', () => {
  let map = (name: string, value: number | null, attributes = {}, overrides = {}) =>
    genAiOtlp.mapMetric!(
      ctx('metrics'),
      metricPoint(name, value, attributes as never, { unit: '', ...overrides })
    );

  it('maps token usage with a type warning', () => {
    let [mapped] = map('gen_ai.client.token.usage', 120, {
      'gen_ai.token.type': 'input',
      'gen_ai.request.model': 'm',
      'gen_ai.provider.name': 'openai'
    });

    expect(mapped?.draft).toMatchObject({
      type: 'tokens',
      warnings: ['token_type_includes_cache'],
      data: {
        value: 120,
        covers: ['model.request'],
        dims: { model: 'm', provider: 'openai', token_type: 'input' }
      },
      dropped: []
    });
  });

  it('flags output tokens as including reasoning', () => {
    expect(
      map('gen_ai.client.token.usage', 1, { 'gen_ai.token.type': 'output' })[0]?.draft.warnings
    ).toEqual(['token_type_includes_reasoning']);
  });

  it.each([undefined, 'total', 'bogus', 'constructor', '__proto__', 'toString'])(
    'suppresses token usage with the type %s',
    tokenType => {
      let attributes = tokenType === undefined ? {} : { 'gen_ai.token.type': tokenType };

      expect(map('gen_ai.client.token.usage', 5, attributes)).toEqual([]);
    }
  );

  it('converts durations from seconds to milliseconds', () => {
    let [duration] = map(
      'gen_ai.client.operation.duration',
      1.5,
      { 'error.type': 'timeout', 'gen_ai.request.model': 'm' },
      { shape: 'histogram', histogram: { count: 1, sum: 1.5 }, value: null }
    );

    expect(duration?.draft).toMatchObject({
      type: 'request.duration',
      data: { value: 1500, unit: 'ms', dims: { model: 'm', outcome: 'error' } }
    });

    expect(map('gen_ai.client.operation.time_to_first_chunk', 0.25)[0]?.draft).toMatchObject({
      type: 'request.ttft',
      data: { value: 250 }
    });
  });

  it('reports unused attributes by name only', () => {
    let [mapped] = map('gen_ai.client.operation.duration', 1, {
      'gen_ai.request.model': 'm',
      'http.url': 'https://SENTINEL.example'
    });

    expect(mapped?.draft.dropped).toEqual(['attr:http.url']);
    expect(JSON.stringify({ ...mapped?.draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('suppresses unknown metrics and null values', () => {
    expect(map('http.server.duration', 1)).toEqual([]);
    expect(map('gen_ai.client.operation.duration', null)).toEqual([]);
  });
});

describe('genAiOtlp.mapLog', () => {
  it('maps any log to a diagnostic without content', () => {
    let log = logRecord(
      {
        'event.name': 'gen_ai.client.inference.operation.details',
        'gen_ai.input.messages': 'SENTINEL'
      },
      {
        body: { messages: 'SENTINEL-BODY' },
        traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        spanId: 'bbbbbbbbbbbbbbbb'
      }
    );

    let [mapped] = genAiOtlp.mapLog!(ctx('logs', log), log);

    expect(mapped?.draft).toMatchObject({
      type: 'unmapped',
      signalName: 'gen_ai.client.inference.operation.details',
      ctx: {
        trace: { traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', spanId: 'bbbbbbbbbbbbbbbb' }
      },
      data: {
        native_name: 'gen_ai.client.inference.operation.details',
        category: 'diagnostic'
      }
    });
    expect(JSON.stringify({ ...mapped?.draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('falls back to the event name and then unknown', () => {
    let named = logRecord({}, { eventName: 'gen_ai.x' });
    let anonymous = logRecord({}, {});

    expect(genAiOtlp.mapLog!(ctx('logs'), named)[0]?.draft.signalName).toBe('gen_ai.x');
    expect(genAiOtlp.mapLog!(ctx('logs'), anonymous)[0]?.draft.signalName).toBe('unknown');
  });
});
