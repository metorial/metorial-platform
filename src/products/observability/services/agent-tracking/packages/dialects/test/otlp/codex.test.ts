import { fullIngestPolicy } from '@mtsrc/agent-tracking-spec';
import { describe, expect, it } from 'vitest';
import { buildMapped } from '../build';
import {
  groupOf,
  logRecord,
  metricPoint,
  nanosOf,
  otlpAt,
  spanOf
} from '@mtsrc/agent-tracking-otlp/test/otlp';
import { decodeOtlp, type OtlpAttributes } from '@mtsrc/agent-tracking-otlp';
import { groupContext } from '../../src/otlp/common';
import { codexOtlp, codexOtlpId } from '../../src/otlp/codex';
import { mapOtlpGroup } from '../../src/registry';

let resource: OtlpAttributes = {
  'service.name': 'codex_cli_rs',
  'service.version': '0.60.0',
  'user.email': 'dev@example.com'
};

let ctx = (signal: 'logs' | 'metrics' | 'traces', overrides: OtlpAttributes = {}) =>
  groupContext(signal, groupOf([], { ...resource, ...overrides }));

let mapLog = (event: string, attributes: OtlpAttributes = {}, overrides = {}) =>
  codexOtlp.mapLog!(
    ctx('logs'),
    logRecord(
      { 'event.name': event, 'conversation.id': 'conv-1', 'turn.id': 'turn-1', ...attributes },
      overrides
    )
  );

let one = (event: string, attributes: OtlpAttributes = {}, overrides = {}) => {
  let mapped = mapLog(event, attributes, overrides);

  expect(mapped).toHaveLength(1);

  return mapped[0]!.draft;
};

let mapMetric = (name: string, value: number | null, attributes: OtlpAttributes = {}) =>
  codexOtlp.mapMetric!(ctx('metrics'), metricPoint(name, value, attributes));

let mapSpan = (name: string, attributes: OtlpAttributes = {}, overrides = {}) =>
  codexOtlp.mapSpan!(ctx('traces'), spanOf(name, attributes, overrides));

let oneSpan = (name: string, attributes: OtlpAttributes = {}, overrides = {}) => {
  let mapped = mapSpan(name, attributes, overrides);

  expect(mapped).toHaveLength(1);

  return mapped[0]!.draft;
};

describe('codexOtlp.matches', () => {
  let match = (resourceAttrs: OtlpAttributes, scope = '') =>
    codexOtlp.matches(groupContext('logs', groupOf([], resourceAttrs, { name: scope })));

  it.each(['codex_cli_rs', 'codex_exec', 'codex-app-server', 'codex-exec-server'])(
    'matches service %s',
    service => {
      expect(match({ 'service.name': service })).toBe(true);
    }
  );

  it('matches by scope prefix', () => {
    expect(match({}, 'codex_otel.trace_safe')).toBe(true);
  });

  it('does not match other clients', () => {
    expect(match({ 'service.name': 'claude-code' })).toBe(false);
    expect(match({ 'service.name': 'codex' })).toBe(false);
    expect(match({}, 'other')).toBe(false);
  });
});

describe('codexOtlp event naming and shared fields', () => {
  it('strips the codex prefix and uses the event name fallback', () => {
    expect(one('codex.user_prompt').type).toBe('prompt.submitted');

    let [mapped] = codexOtlp.mapLog!(
      ctx('logs'),
      logRecord({}, { eventName: 'codex.user_prompt' })
    );

    expect(mapped?.draft.type).toBe('prompt.submitted');
  });

  it('turns unknown events into diagnostics', () => {
    expect(one('brand_new_event')).toMatchObject({
      type: 'unmapped',
      signalName: 'brand_new_event',
      data: { native_name: 'brand_new_event', category: 'diagnostic' }
    });
  });

  it.each(['constructor', '__proto__', 'toString'])(
    'does not resolve the prototype key %s',
    name => {
      expect(one(name).type).toBe('unmapped');
    }
  );

  it('builds client, actor and context from the attributes', () => {
    let draft = one('user_prompt', {
      originator: 'codex_vscode',
      'app.version': '0.61.0',
      'terminal.type': 'vscode',
      auth_mode: 'ChatGPT',
      'user.account_id': 'acc-1'
    });

    expect(draft).toMatchObject({
      occurredAt: new Date(otlpAt),
      client: {
        family: 'codex',
        surface: 'ide',
        version: '0.61.0',
        terminal: 'vscode',
        auth_mode: 'ChatGPT'
      },
      actor: { user: { id: 'acc-1', email: 'dev@example.com' } },
      ctx: { sessionId: 'conv-1', turnId: 'turn-1' }
    });
  });

  it.each([
    ['codex_cli_rs', 'cli'],
    ['codex_exec', 'cli'],
    ['codex-exec-server', 'cli'],
    ['codex-app-server', 'app_server']
  ])('derives the surface from service %s', (service, surface) => {
    let log = logRecord({ 'event.name': 'user_prompt' });
    let [mapped] = codexOtlp.mapLog!(
      groupContext('logs', groupOf([log], { 'service.name': service })),
      log
    );

    expect(mapped?.draft.client).toMatchObject({ surface });
  });

  it('reads the session id from any known key', () => {
    for (let key of ['conversation.id', 'session.id', 'thread.id']) {
      let log = logRecord({ 'event.name': 'user_prompt', [key]: 'x' });
      let [mapped] = codexOtlp.mapLog!(ctx('logs'), log);

      expect(mapped?.draft.ctx?.sessionId).toBe('x');
    }
  });

  it('keeps identities stable per event', () => {
    let a = one('user_prompt');
    let b = one('user_prompt');
    let c = one('user_prompt', { 'turn.id': 'turn-2' });

    expect(a.identity).toBe(b.identity);
    expect(a.identity).not.toBe(c.identity);
  });
});

describe('codexOtlp log events', () => {
  it('maps conversation starts', () => {
    expect(
      one('conversation_starts', {
        provider_name: 'OpenAI',
        reasoning_effort: 'high',
        model: 'gpt-5',
        context_window: 400000,
        approval_policy: 'on-request',
        sandbox_policy: 'workspace-write'
      })
    ).toMatchObject({
      type: 'session.start',
      data: {
        model: 'gpt-5',
        provider: 'openai',
        effort: 'high',
        context_window: 400000,
        approval_policy: 'on-request',
        sandbox_policy: 'workspace-write'
      }
    });
  });

  it('maps successful and failed api requests as supplemental', () => {
    expect(
      one('api_request', { 'http.response.status_code': 200, duration_ms: 120, attempt: 1 })
    ).toMatchObject({
      type: 'model.request',
      role: 'supplemental',
      durationMs: 120,
      data: { outcome: 'ok', attempt: 1 }
    });

    let failed = one('api_request', {
      'http.response.status_code': 503,
      'error.message': 'SENTINEL upstream'
    });

    expect(failed.data).toMatchObject({
      outcome: 'error',
      error: { class: 'overloaded', status_code: 503 }
    });
    expect(failed.content).toEqual([
      expect.objectContaining({ role: 'error_message', value: 'SENTINEL upstream' })
    ]);
  });

  it('has no outcome without a status code', () => {
    expect(one('api_request').data).toEqual({});
  });

  it('maps no api request without a session id', () => {
    let daemonRequest = logRecord(
      { 'event.name': 'api_request', duration_ms: 120, attempt: 1 },
      { traceId: '0'.repeat(32), spanId: '0'.repeat(16) }
    );

    expect(
      codexOtlp.mapLog!(ctx('logs', { 'service.name': 'codex-app-server' }), daemonRequest)
    ).toEqual([]);
  });

  it('keeps no trace from all-zero ids and keeps a real trace', () => {
    let zero = { traceId: '0'.repeat(32), spanId: '0'.repeat(16) };
    let real = { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7' };

    expect(one('user_prompt', {}, zero).ctx).not.toHaveProperty('trace');
    expect(one('user_prompt', {}, real).ctx?.trace).toEqual(real);
  });

  it('keeps an api request with a conversation id unchanged', () => {
    expect(one('api_request', { 'http.response.status_code': 200 })).toMatchObject({
      type: 'model.request',
      role: 'supplemental',
      ctx: { sessionId: 'conv-1', turnId: 'turn-1' }
    });
  });

  it('only maps completed sse events', () => {
    expect(mapLog('sse_event', { 'event.kind': 'response.created' })).toEqual([]);
    expect(mapLog('sse_event', {})).toEqual([]);
  });

  it('derives usage from the completed sse event', () => {
    let draft = one('sse_event', {
      'event.kind': 'response.completed',
      input_token_count: 1000,
      cached_token_count: 300,
      output_token_count: 200,
      reasoning_token_count: 50,
      tool_token_count: 1300,
      ttft_ms: 250,
      service_tier: 'priority',
      model_reasoning_effort: 'medium',
      model: 'gpt-5'
    });

    expect(draft).toMatchObject({
      type: 'model.request',
      derived: ['usage.input_uncached', 'usage.output'],
      data: {
        outcome: 'ok',
        model: { id: 'gpt-5' },
        usage: {
          provenance: 'derived',
          input_uncached: 700,
          cache_read: 300,
          output: 150,
          reasoning: 50
        },
        ttft_ms: 250,
        service_tier: 'priority',
        effort: 'medium'
      }
    });
  });

  it('maps prompts, responses and their content', () => {
    expect(one('user_prompt', { prompt: 'SENTINEL', prompt_length: 8 })).toMatchObject({
      type: 'prompt.submitted',
      data: { length_chars: 8 },
      content: [{ role: 'prompt', value: 'SENTINEL', clientLength: 8 }]
    });
    expect(
      one('agent_response', { response: 'SENTINEL', response_length: 8, 'agent.type': 'main' })
    ).toMatchObject({
      type: 'message.assistant',
      data: { final: true, agent_type: 'main', length_chars: 8 },
      content: [{ role: 'response', value: 'SENTINEL' }]
    });
  });

  it.each([
    [
      'approved',
      'Config',
      { value: 'allow', source: 'config', scope: 'once', automatic: true }
    ],
    ['approved', 'User', { value: 'allow', source: 'user', scope: 'once', automatic: false }],
    [
      'approved_for_session',
      'AutomatedReviewer',
      { value: 'allow', source: 'reviewer', scope: 'session', automatic: true }
    ],
    [
      'approved_mcp_policy_amendment',
      undefined,
      { value: 'allow', source: 'unknown', scope: 'persistent', automatic: false }
    ],
    ['denied', 'User', { value: 'deny', source: 'user', scope: 'once', automatic: false }],
    [
      'timed_out',
      undefined,
      { value: 'deny', source: 'unknown', scope: 'once', automatic: true }
    ],
    ['abort', 'User', { value: 'abort', source: 'user', scope: 'once', automatic: false }]
  ])('maps the decision %s from %s', (decision, source, expected) => {
    let draft = one('tool_decision', {
      decision,
      ...(source ? { source } : {}),
      call_id: 'c-1',
      tool_name: 'shell'
    });

    expect(draft.data?.['decision']).toEqual(expected);
    expect(draft.factKey).toBe('tool:{session_key}:c-1');
  });

  it.each(['constructor', '__proto__', 'toString', 'unheard_of'])(
    'omits the decision for %s',
    decision => {
      expect(one('tool_decision', { decision }).data).not.toHaveProperty('decision');
    }
  );

  it.each(['constructor', '__proto__', 'toString'])(
    'ignores the prototype decision source %s',
    source => {
      expect(
        one('tool_decision', { decision: 'approved', source }).data?.['decision']
      ).toMatchObject({
        source: 'unknown'
      });
    }
  );

  it('maps sandbox outcomes', () => {
    expect(
      one('sandbox_outcome', {
        call_id: 'c',
        tool_name: 'shell',
        outcome: 'escalated',
        initial_duration_ms: 5,
        escalated_duration_ms: 9
      })
    ).toMatchObject({
      type: 'safety.decision',
      role: 'supplemental',
      data: {
        kind: 'sandbox',
        outcome: 'escalated',
        initial_duration_ms: 5,
        escalated_duration_ms: 9
      }
    });
  });

  it('maps tool results with arguments and output as content', () => {
    let draft = one('tool_result', {
      call_id: 'c',
      tool_name: 'shell',
      success: false,
      duration_ms: 10,
      arguments: 'SENTINEL-ARGS',
      output: 'SENTINEL-OUT',
      output_truncated: true
    });

    expect(draft).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:c',
      durationMs: 10,
      data: {
        tool: { name: 'shell', kind: 'shell' },
        outcome: 'error',
        error: { class: 'tool' },
        output_truncated: true
      },
      content: [
        { role: 'tool_input', hints: { tool: 'shell' } },
        { role: 'tool_output', hints: { tool: 'shell' } }
      ]
    });
  });

  it('maps guardian assessments, skills, retries and policy decisions', () => {
    expect(
      one('guardian_assessment', { status: 'done', outcome: 'allow', risk_level: 'low' })
    ).toMatchObject({
      type: 'safety.decision',
      data: { kind: 'reviewer', status: 'done', outcome: 'allow', risk_level: 'low' }
    });
    expect(
      one('skill_invocation', {
        'skill.name': 'pdf',
        'skill.scope': 'user',
        'skill.invocation_type': 'explicit'
      })
    ).toMatchObject({
      type: 'extension.event',
      data: { kind: 'skill', name: 'pdf', source: 'user', trigger: 'explicit' }
    });
    expect(one('retry', { 'retry.attempt': 2, 'retry.delay_ms': 500 })).toMatchObject({
      type: 'model.retry',
      data: { attempt: 2, delay_ms: 500 }
    });
    expect(
      one('network_proxy.policy_decision', { 'network.policy.decision': 'deny' })
    ).toMatchObject({
      type: 'safety.decision',
      data: { kind: 'network_policy', decision: 'deny' }
    });
  });

  it('maps turn costs as late arriving charges', () => {
    expect(
      one('turn_cost', {
        'usage.estimated_usd': 0.25,
        speed: 'fast',
        reasoning_effort: 'low',
        'turn.interrupted': true
      })
    ).toMatchObject({
      type: 'usage.charge',
      factKey: 'turn:{session_key}:turn-1',
      data: {
        cost: { amount: '0.25', unit: 'usd', basis: 'server_estimate', arrives_late: true },
        speed: 'fast',
        effort: 'low',
        interrupted: true
      }
    });
  });

  it('falls back to a diagnostic when the turn cost is missing or invalid', () => {
    let invalid: OtlpAttributes[] = [
      {},
      { 'usage.estimated_usd': -1 },
      { 'usage.estimated_usd': 'x' }
    ];

    for (let attributes of invalid) {
      expect(one('turn_cost', attributes)).toMatchObject({
        type: 'unmapped',
        data: { native_name: 'turn_cost' }
      });
    }
  });

  it('records coerced attributes across the whole event', () => {
    let draft = one('sse_event', {
      'event.kind': 'response.completed',
      input_token_count: '10',
      ttft_ms: '5'
    });

    expect(draft.coerced).toEqual(
      expect.arrayContaining(['log.input_token_count', 'log.ttft_ms'])
    );
  });
});

describe('codexOtlp billing', () => {
  let completed = {
    'event.kind': 'response.completed',
    model: 'gpt-5',
    input_token_count: 10
  };

  let usageDrafts = (authMode?: string) => {
    let auth: OtlpAttributes = authMode === undefined ? {} : { auth_mode: authMode };

    return [
      one('sse_event', { ...completed, ...auth }),
      one('api_request', { 'http.response.status_code': 200, ...auth }),
      one('turn_cost', { 'usage.estimated_usd': 0.25, ...auth }),
      mapMetric('turn.cost_microusd', 250000, { 'turn.id': 'turn-1', ...auth })[0]!.draft,
      oneSpan('handle_responses', { 'gen_ai.usage.input_tokens': 100, ...auth })
    ];
  };

  it('covers every model request and usage charge', () => {
    expect(usageDrafts().map(draft => draft.type)).toEqual([
      'model.request',
      'model.request',
      'usage.charge',
      'usage.charge',
      'model.request'
    ]);
  });

  it.each([
    ['Chatgpt', { mode: 'included' }],
    ['ChatGPT', { mode: 'included' }],
    ['ApiKey', { mode: 'api' }],
    ['api_key', { mode: 'api' }]
  ])('maps the auth mode %s', (authMode, billing) => {
    for (let draft of usageDrafts(authMode)) {
      expect(draft.data?.['billing']).toEqual(billing);
      expect(draft.client).toMatchObject({ auth_mode: authMode });
    }
  });

  it.each([undefined, 'Unknown'])('says nothing for the auth mode %j', authMode => {
    for (let draft of usageDrafts(authMode)) {
      expect(draft.data).not.toHaveProperty('billing');
    }
  });

  it('leaves billing off records that are not usage-bearing', () => {
    expect(one('user_prompt', { auth_mode: 'ApiKey' }).data).not.toHaveProperty('billing');
    expect(
      oneSpan('session_task.turn', {
        auth_mode: 'ApiKey',
        'codex.turn.token_usage.input_tokens': 5
      }).data
    ).not.toHaveProperty('billing');
  });
});

describe('codexOtlp metrics', () => {
  it.each([
    ['tool.call', 'tool.calls', '{call}'],
    ['tool.call.duration_ms', 'tool.duration', 'ms'],
    ['api_request', 'requests', '{request}'],
    ['api_request.duration_ms', 'request.duration', 'ms'],
    ['turn.token_usage', 'tokens', '{token}'],
    ['turn.ttft.duration_ms', 'request.ttft', 'ms'],
    ['thread.started', 'sessions', '{session}']
  ])('maps %s', (name, type, unit) => {
    let [mapped] = mapMetric(
      `codex.${name}`,
      4,
      name == 'turn.token_usage' ? { token_type: 'input' } : {}
    );

    expect(mapped?.draft).toMatchObject({
      kind: 'measurement',
      type,
      data: { unit, value: 4 }
    });
    expect(mapped?.source).toEqual({
      adapter: 'codex',
      dialect: codexOtlpId,
      channel: 'otlp.metrics'
    });
  });

  it('accepts names without the prefix', () => {
    expect(mapMetric('thread.started', 1)).toHaveLength(1);
  });

  it('derives outcome dimensions from the success flag', () => {
    let dims = (attributes: OtlpAttributes) =>
      mapMetric('tool.call', 1, { tool: 'shell', ...attributes })[0]?.draft.data?.['dims'];

    expect(dims({ success: true })).toEqual({ tool_name: 'shell', outcome: 'ok' });
    expect(dims({ success: 'false' })).toEqual({ tool_name: 'shell', outcome: 'error' });
    expect(dims({})).toEqual({ tool_name: 'shell' });
  });

  it.each([
    ['input', 'input', 'token_type_includes_cache'],
    ['cached_input', 'cache_read', undefined],
    ['cache_write_input', 'cache_write', undefined],
    ['output', 'output', 'token_type_includes_reasoning'],
    ['reasoning_output', 'reasoning', undefined]
  ])('maps the token type %s', (nativeType, type, warning) => {
    let [mapped] = mapMetric('turn.token_usage', 7, { token_type: nativeType });

    expect(mapped?.draft.data?.['dims']).toEqual({ token_type: type });
    expect(mapped?.draft.warnings).toEqual(warning ? [warning] : undefined);
  });

  it('suppresses the total token type', () => {
    expect(mapMetric('turn.token_usage', 7, { token_type: 'total' })).toEqual([]);
  });

  it.each(['constructor', '__proto__', 'toString', 'unknown_type'])(
    'drops the token type %s without a prototype lookup',
    nativeType => {
      let [mapped] = mapMetric('turn.token_usage', 7, { token_type: nativeType });

      expect(mapped?.draft.data?.['dims']).toEqual({});
      expect(mapped?.draft.warnings).toBeUndefined();
    }
  );

  it('maps the cost metric as a duplicate charge', () => {
    let [mapped] = mapMetric('codex.turn.cost_microusd', 250000, {
      'conversation.id': 'conv-1',
      'turn.id': 'turn-1',
      speed: 'fast',
      reasoning_effort: 'high'
    });

    expect(mapped?.draft).toMatchObject({
      kind: 'event',
      type: 'usage.charge',
      role: 'duplicate',
      factKey: 'turn:{session_key}:turn-1',
      ctx: { sessionId: 'conv-1', turnId: 'turn-1' },
      data: {
        cost: { amount: '0.25', unit: 'usd', basis: 'server_estimate', arrives_late: true },
        speed: 'fast',
        effort: 'high'
      }
    });
  });

  it('suppresses invalid cost values', () => {
    expect(mapMetric('turn.cost_microusd', null)).toEqual([]);
    expect(mapMetric('turn.cost_microusd', -5)).toEqual([]);
    expect(mapMetric('turn.cost_microusd', 1.5)).toEqual([]);
  });

  it('suppresses unknown metrics and prototype names', () => {
    expect(mapMetric('nope', 1)).toEqual([]);
    expect(mapMetric('constructor', 1)).toEqual([]);
    expect(mapMetric('__proto__', 1)).toEqual([]);
  });

  it('records coercion for dimension attributes', () => {
    let [mapped] = mapMetric('tool.call', 1, { tool: 'shell', success: 'true' });

    expect(mapped?.draft.coerced).toContain('metric.success');
  });
});

describe('codexOtlp spans', () => {
  it('suppresses the quiet spans', () => {
    for (let name of [
      'session_loop',
      'session_task.run',
      'run_turn',
      'codex.sampling',
      'mcp.http.request',
      'app_server.request',
      'receiving_stream'
    ]) {
      expect(mapSpan(name)).toEqual([]);
    }
  });

  it('maps turns as aggregates with derived usage', () => {
    let draft = oneSpan('session_task.turn', {
      'conversation.id': 'conv-1',
      'turn.id': 'turn-1',
      model: 'gpt-5',
      'codex.turn.reasoning_effort': 'high',
      'codex.turn.token_usage.input_tokens': 1000,
      'codex.turn.token_usage.cached_input_tokens': 600,
      'codex.turn.token_usage.output_tokens': 100,
      'codex.turn.token_usage.reasoning_output_tokens': 20,
      'codex.turn.token_usage.total_tokens': 1100
    });

    expect(draft).toMatchObject({
      type: 'turn.completed',
      role: 'aggregate',
      factKey: 'turn:{session_key}:turn-1',
      durationMs: 2000,
      data: {
        outcome: 'ok',
        model: { id: 'gpt-5' },
        effort: 'high',
        usage: {
          provenance: 'aggregate',
          input_uncached: 400,
          cache_read: 600,
          output: 80,
          reasoning: 20,
          total_reported: 1100
        }
      }
    });
    expect(oneSpan('session_task.turn', {}, { statusCode: 2 }).data).toMatchObject({
      outcome: 'error'
    });
  });

  it('maps compaction spans', () => {
    expect(oneSpan('session_task.compact')).toMatchObject({
      type: 'context.compaction',
      data: { outcome: 'ok', duration_ms: 2000 }
    });
  });

  it('maps response handling spans only when usage is present', () => {
    expect(mapSpan('handle_responses')).toEqual([]);

    expect(
      oneSpan('handle_responses', {
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 10,
        'codex.request.reasoning_effort': 'low'
      })
    ).toMatchObject({
      type: 'model.request',
      data: { usage: { input_uncached: 100, output: 10 }, effort: 'low' }
    });
  });

  it('maps MCP tool calls and their errors', () => {
    expect(
      oneSpan('mcp.tools.call', {
        'tool.call_id': 'tc',
        'tool.name': 'search',
        'mcp.server.name': 'github'
      })
    ).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:tc',
      data: { tool: { kind: 'mcp' }, outcome: 'ok' }
    });

    expect(oneSpan('mcp.tools.call', { 'error.type': 'timeout' }).data).toMatchObject({
      outcome: 'error',
      error: { class: 'tool', native_type: 'timeout' }
    });
    expect(oneSpan('mcp.tools.call', {}, { statusCode: 2 }).data).toMatchObject({
      outcome: 'error',
      error: { class: 'tool' }
    });
  });

  it('keeps unknown spans as diagnostics', () => {
    expect(oneSpan('something.else')).toMatchObject({
      type: 'unmapped',
      role: 'supplemental',
      data: { native_name: 'something.else', category: 'diagnostic' }
    });
    expect(oneSpan('GET /SENTINEL path').signalName).toBe('unknown');
  });

  it('has no duration for inverted timestamps', () => {
    expect(
      oneSpan('session_task.compact', {}, { startNs: nanosOf(otlpAt), endNs: 1n }).durationMs
    ).toBeUndefined();
  });

  it('records the span trace context', () => {
    expect(
      oneSpan('session_task.compact', {}, { parentSpanId: 'cccccccccccccccc' }).ctx?.trace
    ).toEqual({
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: 'b7ad6b7169203331',
      parentSpanId: 'cccccccccccccccc'
    });
  });

  it('records coercion that happens after the draft base is built', () => {
    let draft = oneSpan('session_task.turn', { 'codex.turn.token_usage.input_tokens': '5' });

    expect(draft.coerced).toContain('span.codex.turn.token_usage.input_tokens');
  });
});

// Shapes from a live codex exec 0.170.0 capture, with identities and content replaced.
let liveAttributes = (attributes: Record<string, string | number | boolean>) =>
  Object.entries({
    'conversation.id': 'conv-live',
    'app.version': '0.170.0',
    auth_mode: 'Chatgpt',
    originator: 'codex_exec',
    model: 'gpt-model',
    ...attributes
  }).map(([key, value]) => ({
    key,
    value:
      typeof value == 'string'
        ? { stringValue: value }
        : typeof value == 'boolean'
          ? { boolValue: value }
          : { intValue: String(value) }
  }));

let liveRecord = (
  observed: string,
  attributes: Record<string, string | number | boolean>
) => ({
  timeUnixNano: '0',
  observedTimeUnixNano: observed,
  severityNumber: 9,
  severityText: 'INFO',
  eventName: 'event otel/src/events/session_telemetry.rs:1187',
  attributes: liveAttributes(attributes)
});

let mapLive = (records: unknown[]) => {
  let body = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'codex_exec' } },
            { key: 'service.version', value: { stringValue: '0.170.0' } }
          ]
        },
        scopeLogs: [{ scope: { name: 'codex_otel.log_only' }, logRecords: records }]
      }
    ]
  };

  let decoded = decodeOtlp('logs', 'json', new TextEncoder().encode(JSON.stringify(body)));
  let group = decoded.groups[0]!;

  return group.items.flatMap(log => codexOtlp.mapLog!(groupContext('logs', group), log));
};

let completed = (tokens: { input: string; output: string; ttft?: string }) => ({
  'event.name': 'codex.sse_event',
  'event.kind': 'response.completed',
  input_token_count: tokens.input,
  output_token_count: tokens.output,
  cached_token_count: '0',
  cache_write_token_count: '0',
  reasoning_token_count: '0',
  tool_token_count: String(Number(tokens.input) + Number(tokens.output)),
  ...(tokens.ttft ? { ttft_ms: tokens.ttft, model_reasoning_effort: 'low' } : {}),
  'event.timestamp': '2026-11-25T12:04:05.122Z'
});

let toolResult = (
  seq: number,
  tool: { name: string; namespace: string; callId: string; server?: string }
) => ({
  'event.name': 'codex.tool_result',
  tool_result_seq: seq,
  tool_name: tool.name,
  tool_namespace: tool.namespace,
  call_id: tool.callId,
  duration_ms: '1',
  success: 'true',
  output_truncated: false,
  agent_name: '/root',
  arguments: '{}',
  output: 'ok',
  mcp_server: tool.server ?? '',
  mcp_server_origin: tool.server ? 'stdio' : '',
  'event.timestamp': '2026-11-25T12:04:08.569Z'
});

describe('codexOtlp live exports', () => {
  it('gives every record its own identity although the event time is always zero', () => {
    let mapped = mapLive([
      liveRecord(
        '1795608245122693000',
        completed({ input: '23922', output: '60', ttft: '1606' })
      ),
      liveRecord(
        '1795608248506066000',
        completed({ input: '24157', output: '26', ttft: '1780' })
      ),
      liveRecord('1795608242265544000', {
        'event.name': 'codex.user_prompt',
        prompt_length: '20',
        prompt: '[REDACTED]',
        'event.timestamp': '2026-11-25T12:04:02.265Z'
      }),
      liveRecord('1795608242305851000', {
        'event.name': 'codex.websocket_request',
        duration_ms: '1',
        success: 'true',
        'event.timestamp': '2026-11-25T12:04:02.305Z'
      }),
      liveRecord('1795608246397127000', {
        'event.name': 'codex.websocket_request',
        duration_ms: '0',
        success: 'true',
        'event.timestamp': '2026-11-25T12:04:06.397Z'
      })
    ]);

    let identities = mapped.map(entry => entry.draft.identity);

    expect(identities).toHaveLength(5);
    expect(new Set(identities).size).toBe(5);
    expect(mapped[0]!.draft.occurredAt).toEqual(new Date('2026-11-25T12:04:05.122Z'));
  });

  it('keeps records apart by their timestamp and sequence when no time is sent', () => {
    let a = one(
      'tool_result',
      { tool_result_seq: 1, 'event.timestamp': '2026-11-25T12:04:06.269Z' },
      { timeNs: 0n }
    );
    let b = one(
      'tool_result',
      { tool_result_seq: 2, 'event.timestamp': '2026-11-25T12:04:06.269Z' },
      { timeNs: 0n }
    );
    let c = one(
      'user_prompt',
      { 'event.timestamp': '2026-11-25T12:04:02.265Z' },
      { timeNs: 0n }
    );
    let d = one(
      'user_prompt',
      { 'event.timestamp': '2026-11-25T12:04:09.000Z' },
      { timeNs: 0n }
    );

    expect(a.identity).not.toBe(b.identity);
    expect(c.identity).not.toBe(d.identity);
    expect(a.coerced).toEqual([]);
  });

  it('counts a completed HTTP response once', () => {
    let mapped = mapLive([
      liveRecord('1795608120654198000', {
        'event.name': 'codex.sse_event',
        'event.kind': 'response.created',
        duration_ms: '0'
      }),
      liveRecord('1795608120655431000', {
        'event.name': 'codex.sse_event',
        'event.kind': 'response.completed',
        duration_ms: '0'
      }),
      liveRecord('1795608120655501000', completed({ input: '1200', output: '50' }))
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]!.draft).toMatchObject({
      type: 'model.request',
      data: { usage: { input_uncached: 1200, output: 50 } }
    });
    expect(mapped[0]!.draft.role).toBeUndefined();
  });

  it('keeps a real response without output counted', () => {
    let [http, reasoned] = mapLive([
      liveRecord('1795608120655501000', completed({ input: '1200', output: '0' })),
      liveRecord('1795608245122693000', {
        ...completed({ input: '2', output: '0' }),
        model_reasoning_effort: 'low'
      })
    ]);

    expect(http!.draft.role).toBeUndefined();
    expect(http!.draft.data).not.toHaveProperty('warmup');
    expect(reasoned!.draft.role).toBeUndefined();
  });

  it('keeps the websocket prewarm out of the counted requests', () => {
    let [prewarm, request] = mapLive([
      liveRecord('1795608241821275000', completed({ input: '2', output: '0' })),
      liveRecord(
        '1795608245122693000',
        completed({ input: '23922', output: '60', ttft: '1606' })
      )
    ]);

    expect(prewarm!.draft).toMatchObject({
      type: 'model.request',
      role: 'supplemental',
      data: { purpose: 'auxiliary', warmup: true, usage: { input_uncached: 2, output: 0 } }
    });
    expect(request!.draft.role).toBeUndefined();
    expect(request!.draft.data).not.toHaveProperty('warmup');
  });

  it('counts the tools a code-mode script calls, not the script wrapper', () => {
    let mapped = mapLive([
      liveRecord(
        '1795608246269802000',
        toolResult(1, { name: 'exec_command', namespace: 'functions', callId: 'exec-1' })
      ),
      liveRecord(
        '1795608246311751000',
        toolResult(2, { name: 'exec', namespace: 'functions', callId: 'call_1' })
      ),
      liveRecord(
        '1795608248569888000',
        toolResult(3, {
          name: 'probe_echo',
          namespace: 'mcp__probe',
          callId: 'exec-2',
          server: 'probe'
        })
      ),
      liveRecord(
        '1795608248591909000',
        toolResult(4, { name: 'exec', namespace: 'functions', callId: 'call_2' })
      )
    ]);

    let counted = mapped.filter(entry => (entry.draft.role ?? 'primary') == 'primary');

    expect(counted.map(entry => entry.draft.data?.['tool'])).toEqual([
      expect.objectContaining({ name: 'exec_command', kind: 'shell' }),
      expect.objectContaining({ kind: 'mcp', mcp: { server: 'probe', tool: 'probe_echo' } })
    ]);
    expect(mapped[1]!.draft).toMatchObject({
      type: 'tool.call',
      role: 'supplemental',
      factKey: 'tool:{session_key}:call_1',
      data: { code_mode: 'wrapper' }
    });
  });

  it('counts a code-mode script that failed', () => {
    let [failed] = mapLive([
      liveRecord('1795608246311751000', {
        ...toolResult(2, { name: 'exec', namespace: 'functions', callId: 'call_1' }),
        success: 'false'
      })
    ]);

    expect(failed!.draft.role).toBeUndefined();
    expect(failed!.draft.data).toMatchObject({ outcome: 'error', code_mode: 'wrapper' });
  });
});

describe('codexOtlp through buildRecord', () => {
  it('builds valid records for logs, metrics and spans', () => {
    let mapped = [
      ...mapLog('user_prompt', { prompt: 'x' }),
      ...mapMetric('thread.started', 1),
      ...mapSpan('session_task.compact')
    ];

    for (let entry of mapped) {
      let record = buildMapped(entry, { route: 'otlp_http' });

      expect(record.source.adapter).toBe('codex');
    }
  });
});

describe('codexOtlp with tool details off', () => {
  let noToolDetails = { toolDetails: false, sessionContext: true };

  let mcpResult = () =>
    logRecord({
      'event.name': 'codex.tool_result',
      'conversation.id': 'conv-1',
      call_id: 'call-1',
      tool_name: 'probe_echo',
      tool_namespace: 'mcp__probe',
      mcp_server: 'probe',
      mcp_server_origin: 'stdio',
      arguments: '{"text":"SENTINEL-args"}',
      output: 'SENTINEL-output',
      success: 'true',
      duration_ms: '1'
    });

  it('stores MCP tool calls without arguments, output or names', () => {
    let { mapped } = mapOtlpGroup('logs', groupOf([mcpResult()], resource), noToolDetails);
    let [call] = mapped;

    expect(mapped).toHaveLength(1);
    expect(call!.draft).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:call-1',
      content: [],
      data: { tool: { name: 'mcp_tool', kind: 'mcp', class: 'mcp' }, outcome: 'ok' }
    });
    expect(JSON.stringify(mapped)).not.toMatch(/SENTINEL|probe/);
  });

  it('keeps arguments, output and names with detailed tool reporting on', () => {
    let { mapped } = mapOtlpGroup('logs', groupOf([mcpResult()], resource), fullIngestPolicy);

    expect(mapped[0]!.draft.data?.['tool']).toMatchObject({
      name: 'probe_echo',
      mcp: { server: 'probe', tool: 'probe_echo' }
    });
    expect(mapped[0]!.draft.content).toHaveLength(2);
  });

  it('stores MCP spans without server or tool names', () => {
    let { mapped } = mapOtlpGroup(
      'traces',
      groupOf(
        [
          spanOf('mcp.tools.call', {
            'conversation.id': 'conv-1',
            'mcp.server.name': 'probe',
            'mcp.server.origin': 'stdio',
            'tool.name': 'probe_echo',
            'tool.call_id': 'call-1'
          })
        ],
        resource
      ),
      noToolDetails
    );

    expect(mapped[0]!.draft.data?.['tool']).toEqual({
      name: 'mcp_tool',
      kind: 'mcp',
      class: 'mcp'
    });
    expect(JSON.stringify(mapped)).not.toContain('probe');
  });
});
