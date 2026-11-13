import { describe, expect, it } from 'vitest';
import { buildMapped } from '../../../test/build';
import { groupOf, logRecord, metricPoint, nanosOf, otlpAt, spanOf } from '../../../test/otlp';
import type { OtlpAttributes } from '../../../otlp/model';
import { groupContext } from '../common';
import { claudeCodeOtlp, claudeCodeOtlpId } from '../claudeCode';

let resource: OtlpAttributes = {
  'service.name': 'claude-code',
  'service.version': '2.1.0',
  'user.email': 'dev@example.com'
};

let ctx = (signal: 'logs' | 'metrics' | 'traces', overrides: OtlpAttributes = {}) =>
  groupContext(signal, groupOf([], { ...resource, ...overrides }));

let mapLog = (event: string, attributes: OtlpAttributes = {}, overrides = {}) => {
  let log = logRecord(
    { 'event.name': event, 'session.id': 'sess-1', 'prompt.id': 'prompt-1', ...attributes },
    overrides
  );

  return claudeCodeOtlp.mapLog!(ctx('logs'), log);
};

let one = (event: string, attributes: OtlpAttributes = {}, overrides = {}) => {
  let mapped = mapLog(event, attributes, overrides);

  expect(mapped).toHaveLength(1);

  return mapped[0]!.draft;
};

let mapMetric = (name: string, value: number | null, attributes: OtlpAttributes = {}) =>
  claudeCodeOtlp.mapMetric!(ctx('metrics'), metricPoint(name, value, attributes));

let mapSpan = (name: string, attributes: OtlpAttributes = {}, overrides = {}) => {
  let mapped = claudeCodeOtlp.mapSpan!(ctx('traces'), spanOf(name, attributes, overrides));

  expect(mapped).toHaveLength(1);

  return mapped[0]!.draft;
};

describe('claudeCodeOtlp.matches', () => {
  let match = (resourceAttrs: OtlpAttributes, scope = '', sample?: string) =>
    claudeCodeOtlp.matches({
      ...groupContext('logs', groupOf([], resourceAttrs, { name: scope })),
      sampleName: sample
    });

  it.each(['claude-code', 'claude-code-desktop', 'cowork', 'claude-desktop'])(
    'matches service %s',
    service => {
      expect(match({ 'service.name': service })).toBe(true);
    }
  );

  it('matches by scope and by sample name prefix', () => {
    expect(match({}, 'com.anthropic.claude_code.events')).toBe(true);
    expect(match({}, 'com.anthropic.claude_code')).toBe(true);
    expect(match({}, '', 'claude_code.api_request')).toBe(true);
  });

  it('does not match other clients', () => {
    expect(match({ 'service.name': 'codex_cli_rs' })).toBe(false);
    expect(match({ 'service.name': 'claude-code-extra' })).toBe(false);
    expect(match({}, 'com.anthropic.other', 'claude.api_request')).toBe(false);
    expect(match({})).toBe(false);
  });
});

describe('claudeCodeOtlp event naming', () => {
  it('reads the event name from the attribute, the prefixed body, or the event name', () => {
    let fromAttribute = claudeCodeOtlp.mapLog!(
      ctx('logs'),
      logRecord({ 'event.name': 'claude_code.user_prompt' })
    );
    let fromBody = claudeCodeOtlp.mapLog!(
      ctx('logs'),
      logRecord({}, { body: 'claude_code.user_prompt' })
    );
    let fromEventName = claudeCodeOtlp.mapLog!(
      ctx('logs'),
      logRecord({}, { eventName: 'user_prompt' })
    );

    for (let [mapped] of [fromAttribute, fromBody, fromEventName]) {
      expect(mapped?.draft.type).toBe('prompt.submitted');
    }
  });

  it('ignores an unprefixed body', () => {
    let [mapped] = claudeCodeOtlp.mapLog!(ctx('logs'), logRecord({}, { body: 'user_prompt' }));

    expect(mapped?.draft).toMatchObject({ type: 'unmapped', signalName: 'unknown' });
  });

  it('keeps unknown events as diagnostics with a sanitized name', () => {
    expect(one('something_new')).toMatchObject({
      type: 'unmapped',
      signalName: 'something_new',
      data: { native_name: 'something_new', category: 'diagnostic' }
    });
    expect(one('weird name with spaces')).toMatchObject({
      signalName: 'unknown',
      data: { native_name: 'unknown' }
    });
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not resolve the prototype key %s as an event',
    name => {
      expect(one(name).type).toBe('unmapped');
    }
  );
});

describe('claudeCodeOtlp shared log fields', () => {
  it('builds the client, actor, session and trace context', () => {
    let draft = one(
      'user_prompt',
      { 'app.entrypoint': 'vscode', 'terminal.type': 'iTerm.app', 'user.id': 'u-1' },
      { traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', spanId: 'bbbbbbbbbbbbbbbb' }
    );

    expect(draft).toMatchObject({
      kind: 'event',
      occurredAt: new Date(otlpAt),
      client: {
        family: 'claude-code',
        surface: 'ide',
        version: '2.1.0',
        terminal: 'iTerm.app'
      },
      actor: {
        install_id: 'u-1',
        user: { email: 'dev@example.com' },
        identity_source: 'client_claim'
      },
      ctx: {
        sessionId: 'sess-1',
        turnId: 'prompt-1',
        trace: { traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', spanId: 'bbbbbbbbbbbbbbbb' }
      }
    });
  });

  it('infers the desktop surface from the service name', () => {
    let log = logRecord({ 'event.name': 'user_prompt' });
    let [mapped] = claudeCodeOtlp.mapLog!(
      groupContext('logs', groupOf([log], { 'service.name': 'cowork' })),
      log
    );

    expect(mapped?.draft.client).toMatchObject({ surface: 'desktop' });
  });

  it('falls back to the event timestamp attribute', () => {
    let draft = one(
      'user_prompt',
      { 'event.timestamp': '2026-06-15T10:00:00.000Z' },
      { timeNs: 0n }
    );

    expect(draft.occurredAt).toEqual(new Date('2026-06-15T10:00:00.000Z'));
  });

  it('produces stable identities that change with the sequence number', () => {
    let a = one('user_prompt', { 'event.sequence': 1 });
    let b = one('user_prompt', { 'event.sequence': 1 });
    let c = one('user_prompt', { 'event.sequence': 2 });

    expect(a.identity).toBe(b.identity);
    expect(a.identity).not.toBe(c.identity);
  });

  it('records the source', () => {
    expect(mapLog('user_prompt')[0]?.source).toEqual({
      adapter: 'claude-code',
      dialect: claudeCodeOtlpId,
      channel: 'otlp.logs'
    });
  });
});

describe('claudeCodeOtlp api events', () => {
  it('maps api_request with usage, cost and purpose', () => {
    let draft = one('api_request', {
      request_id: 'req-1',
      model: 'claude-opus-4',
      input_tokens: 100,
      cache_read_tokens: 40,
      cache_creation_tokens: 10,
      cache_creation_5m_tokens: 6,
      cache_creation_1h_tokens: 4,
      output_tokens: 25,
      duration_ms: 1234,
      cost_usd: 0.0123,
      speed: 'fast',
      effort: 'high',
      query_source: 'repl_main_thread'
    });

    expect(draft).toMatchObject({
      type: 'model.request',
      factKey: 'req:{session_key}:req-1',
      durationMs: 1234,
      ctx: { requestId: 'req-1' },
      data: {
        outcome: 'ok',
        model: 'claude-opus-4',
        usage: {
          provenance: 'exact',
          input_uncached: 100,
          cache_read: 40,
          cache_write: 10,
          cache_write_5m: 6,
          cache_write_1h: 4,
          output: 25
        },
        cost: { amount: '0.0123', unit: 'usd', basis: 'client_estimate' },
        duration_ms: 1234,
        speed: 'fast',
        effort: 'high',
        purpose: 'main'
      }
    });
  });

  it('prefers micro-dollar costs', () => {
    let draft = one('api_request', { cost_usd_micros: 1500, cost_usd: 9 });

    expect(draft.data?.['cost']).toMatchObject({ amount: '0.0015' });
  });

  it('maps query sources to purposes', () => {
    expect(one('api_request', { query_source: 'compact' }).data).toMatchObject({
      purpose: 'compaction'
    });
    expect(one('api_request', { query_source: 'agent:builtin:explore' }).data).toMatchObject({
      purpose: 'subagent',
      agent_name: 'agent:builtin:explore'
    });
    expect(one('api_request', {}).data).not.toHaveProperty('purpose');
  });

  it('has a null fact key without a request id', () => {
    expect(one('api_request').factKey).toBeNull();
  });

  it('omits usage and cost when absent', () => {
    let { data } = one('api_request');

    expect(data).toEqual({ outcome: 'ok' });
  });

  it('coerces string numbers and records the coercion', () => {
    let draft = one('api_request', { input_tokens: '42', duration_ms: '10' });

    expect(draft.data?.['usage']).toMatchObject({ input_uncached: 42 });
    expect(draft.durationMs).toBe(10);
    expect(draft.coerced?.length).toBeGreaterThan(0);
  });

  it('drops negative counts and floors fractional ones', () => {
    let draft = one('api_request', { input_tokens: -5, output_tokens: 1.5, duration_ms: -1 });

    expect(draft.data?.['usage']).toEqual({ provenance: 'exact', output: 1 });
    expect(draft.durationMs).toBeUndefined();
  });

  it('maps api_error with a classified status', () => {
    let draft = one('api_error', {
      request_id: 'req-2',
      status_code: 429,
      model: 'm',
      attempt: 2,
      duration_ms: 50,
      error: 'SENTINEL rate limited'
    });

    expect(draft).toMatchObject({
      type: 'model.request',
      factKey: 'req:{session_key}:req-2',
      data: {
        outcome: 'error',
        error: { class: 'rate_limit', status_code: 429, retryable: true },
        model: 'm',
        attempt: 2
      },
      content: [{ role: 'error_message', value: 'SENTINEL rate limited' }]
    });
  });

  it('passes truncation hints with error content', () => {
    let draft = one('api_error', {
      error: 'short',
      error_truncated: true,
      error_original_length: 9000
    });

    expect(draft.content).toEqual([
      {
        role: 'error_message',
        value: 'short',
        clientLength: undefined,
        clientTruncated: { originalLength: 9000 }
      }
    ]);
  });

  it('maps exhausted retries', () => {
    expect(
      one('api_retries_exhausted', {
        total_attempts: 5,
        total_retry_duration_ms: 9000,
        status_code: 529
      })
    ).toMatchObject({
      type: 'model.retry',
      data: {
        outcome: 'exhausted',
        error: { class: 'overloaded' },
        attempts: 5,
        retry_duration_ms: 9000
      }
    });
  });

  it('maps refusals', () => {
    expect(
      one('api_refusal', { request_id: 'r', model: 'm', category: 'cyber', attempt: 1 })
    ).toMatchObject({
      type: 'model.request',
      factKey: 'req:{session_key}:r',
      data: { outcome: 'refused', refusal_category: 'cyber', attempt: 1 }
    });
  });
});

describe('claudeCodeOtlp tool events', () => {
  it.each([
    ['accept', 'config', { value: 'allow', source: 'config', scope: 'none', automatic: true }],
    ['accept', 'hook', { value: 'allow', source: 'hook', scope: 'none', automatic: true }],
    [
      'accept',
      'user_permanent',
      { value: 'allow', source: 'user', scope: 'persistent', automatic: false }
    ],
    [
      'accept',
      'user_temporary',
      { value: 'allow', source: 'user', scope: 'session', automatic: false }
    ],
    [
      'reject',
      'user_abort',
      { value: 'abort', source: 'user', scope: 'once', automatic: false }
    ],
    [
      'reject',
      'user_reject',
      { value: 'deny', source: 'user', scope: 'once', automatic: false }
    ],
    [
      'reject',
      'other',
      { value: 'deny', source: 'unknown', scope: 'unknown', automatic: false }
    ]
  ])('maps %s from %s', (decision, source, expected) => {
    expect(one('tool_decision', { decision, source }).data?.['decision']).toEqual(expected);
  });

  it('omits an unknown decision', () => {
    expect(
      one('tool_decision', { decision: 'maybe', source: 'config' }).data
    ).not.toHaveProperty('decision');
  });

  it('classifies the tool and records the mode and verdict', () => {
    let draft = one('tool_decision', {
      tool_use_id: 'tu-1',
      tool_name: 'Bash',
      decision: 'accept',
      source: 'config',
      permission_mode: 'acceptEdits',
      classifier_verdict: 'safe'
    });

    expect(draft).toMatchObject({
      type: 'tool.decision',
      factKey: 'tool:{session_key}:tu-1',
      data: {
        tool: { name: 'Bash', kind: 'shell', class: 'shell' },
        permission_mode: 'acceptEdits',
        classifier_verdict: 'safe'
      }
    });
  });

  it('recognizes MCP tools through the server attribute', () => {
    let draft = one('tool_result', { tool_name: 'search', mcp_server_name: 'github' });

    expect(draft.data?.['tool']).toMatchObject({
      kind: 'mcp',
      mcp: { server: 'github', tool: 'search' }
    });
  });

  it('maps a successful tool result', () => {
    let draft = one('tool_result', {
      tool_use_id: 'tu-2',
      tool_name: 'Read',
      success: true,
      duration_ms: 12,
      tool_input_size_bytes: 40,
      tool_result_size_bytes: 400,
      decision_source: 'config'
    });

    expect(draft).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:tu-2',
      durationMs: 12,
      data: {
        outcome: 'ok',
        input_bytes: 40,
        output_bytes: 400,
        decision_source: 'config'
      },
      content: []
    });
    expect(draft.data).not.toHaveProperty('error');
  });

  it('maps a failed tool result with the error content', () => {
    let draft = one('tool_result', {
      tool_name: 'Bash',
      success: false,
      error_type: 'ShellError',
      error: 'SENTINEL-ERR'
    });

    expect(draft.data).toMatchObject({
      outcome: 'error',
      error: { class: 'tool', native_type: 'ShellError' }
    });
    expect(draft.content).toEqual([
      expect.objectContaining({ role: 'error_message', value: 'SENTINEL-ERR' })
    ]);
  });

  it('collects tool parameters and inputs with the tool hint', () => {
    let draft = one('tool_result', {
      tool_name: 'Bash',
      tool_parameters: '{"command":"ls"}',
      tool_input: '{"command":"pwd"}'
    });

    expect(draft.content).toEqual([
      expect.objectContaining({ role: 'tool_input', hints: { tool: 'Bash' } }),
      expect.objectContaining({ role: 'tool_input', hints: { tool: 'Bash' } })
    ]);
  });

  it('records no outcome when success is unknown', () => {
    expect(one('tool_result', { tool_name: 'Read' }).data).not.toHaveProperty('outcome');
  });
});

describe('claudeCodeOtlp conversation events', () => {
  it('maps prompts with content and length', () => {
    let draft = one('user_prompt', {
      prompt: 'SENTINEL',
      prompt_length: 8,
      command_name: 'review'
    });

    expect(draft).toMatchObject({
      type: 'prompt.submitted',
      data: { length_chars: 8, command_name: 'review' },
      content: [{ role: 'prompt', value: 'SENTINEL', clientLength: 8 }]
    });
  });

  it('keeps only the length for redacted prompts', () => {
    let draft = one('user_prompt', { prompt_length: 20 });

    expect(draft.content).toEqual([]);
    expect(draft.data).toMatchObject({ length_chars: 20 });
  });

  it('maps assistant responses', () => {
    expect(
      one('assistant_response', { response: 'SENTINEL', response_length: 8, model: 'm' })
    ).toMatchObject({
      type: 'message.assistant',
      data: { length_chars: 8, model: 'm' },
      content: [{ role: 'response', value: 'SENTINEL' }]
    });
  });

  it('maps permission mode changes', () => {
    expect(
      one('permission_mode_changed', {
        from_mode: 'default',
        to_mode: 'plan',
        trigger: 'user'
      })
    ).toMatchObject({
      type: 'settings.changed',
      data: { setting: 'permission_mode', from: 'default', to: 'plan', trigger: 'user' }
    });
  });

  it('maps compaction', () => {
    expect(
      one('compaction', {
        trigger: 'auto',
        success: true,
        duration_ms: 500,
        pre_tokens: 180000,
        post_tokens: 20000
      })
    ).toMatchObject({
      type: 'context.compaction',
      durationMs: 500,
      data: { trigger: 'auto', outcome: 'ok', tokens_before: 180000, tokens_after: 20000 }
    });
    expect(one('compaction', { success: false }).data).toMatchObject({ outcome: 'error' });
  });

  it('maps subagent completion as an aggregate with total tokens', () => {
    let draft = one('subagent_completed', {
      agent_type: 'explore',
      total_tool_uses: 7,
      duration_ms: 4000,
      total_tokens: 12000,
      model: 'm'
    });

    expect(draft).toMatchObject({
      type: 'agent.end',
      role: 'aggregate',
      data: {
        status: 'completed',
        name: 'explore',
        type: 'explore',
        usage: { provenance: 'aggregate', total_reported: 12000 },
        tool_uses: 7
      }
    });
  });
});

describe('claudeCodeOtlp session and extension events', () => {
  it('maps authentication', () => {
    expect(
      one('auth', {
        action: 'login',
        success: false,
        auth_method: 'oauth',
        error_category: 'network',
        status_code: 503
      })
    ).toMatchObject({
      type: 'auth.event',
      data: {
        action: 'login',
        outcome: 'error',
        method: 'oauth',
        error_category: 'network',
        status_code: 503
      }
    });
  });

  it('maps MCP connections without exposing urls', () => {
    let draft = one('mcp_server_connection', {
      status: 'connected',
      transport_type: 'stdio',
      server_scope: 'project',
      duration_ms: 90,
      error_code: 'E1',
      server_name: 'github',
      server_url: 'https://SENTINEL.example'
    });

    expect(draft).toMatchObject({
      type: 'mcp.connection',
      durationMs: 90,
      data: {
        status: 'connected',
        transport: 'stdio',
        scope: 'project',
        server_name: 'github'
      }
    });
    expect(JSON.stringify({ ...draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('maps internal errors without the message', () => {
    let draft = one('internal_error', {
      error_name: 'TypeError',
      error_code: 12,
      message: 'SENTINEL'
    });

    expect(draft).toMatchObject({
      type: 'client.error',
      data: { error: { class: 'internal', native_type: 'TypeError' }, error_code: '12' }
    });
    expect(JSON.stringify({ ...draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('maps skills, hooks and plugins', () => {
    expect(
      one('skill_activated', {
        'skill.name': 'pdf',
        invocation_trigger: 'model',
        'skill.source': 'user'
      })
    ).toMatchObject({
      type: 'extension.event',
      data: {
        kind: 'skill',
        action: 'activated',
        name: 'pdf',
        trigger: 'model',
        source: 'user'
      }
    });

    expect(
      one('hook_execution_complete', {
        hook_event: 'PreToolUse',
        hook_name: 'lint',
        num_hooks: 3,
        num_success: 2,
        num_blocking: 1,
        total_duration_ms: 80
      })
    ).toMatchObject({
      type: 'hook.run',
      durationMs: 80,
      data: { hook_event: 'PreToolUse', hooks: 3, succeeded: 2, blocking: 1 }
    });

    expect(one('plugin_installed').data).toEqual({
      kind: 'plugin',
      action: 'installed'
    });
    expect(one('plugin_loaded').data).toEqual({ kind: 'plugin', action: 'loaded' });
  });
});

describe('claudeCodeOtlp metrics', () => {
  it.each([
    ['session.count', 'sessions', '{session}'],
    ['lines_of_code.count', 'lines_changed', '{line}'],
    ['pull_request.count', 'pull_requests', '{pr}'],
    ['commit.count', 'commits', '{commit}'],
    ['cost.usage', 'cost', 'usd'],
    ['token.usage', 'tokens', '{token}'],
    ['code_edit_tool.decision', 'tool.calls', '{call}'],
    ['active_time.total', 'active_time', 's']
  ])('maps %s', (name, type, unit) => {
    let [mapped] = mapMetric(`claude_code.${name}`, 3);

    expect(mapped?.draft).toMatchObject({
      kind: 'measurement',
      type,
      data: { name: type, unit, value: 3 }
    });
    expect(mapped?.source).toEqual({
      adapter: 'claude-code',
      dialect: claudeCodeOtlpId,
      channel: 'otlp.metrics'
    });
  });

  it('accepts names without the prefix', () => {
    expect(mapMetric('session.count', 1)).toHaveLength(1);
  });

  it('maps token types to usage dimensions', () => {
    let types = ['input', 'output', 'cacheRead', 'cacheCreation'];
    let dims = types.map(
      type => mapMetric('token.usage', 1, { type, model: 'm' })[0]?.draft.data?.['dims']
    );

    expect(dims).toEqual([
      { model: 'm', token_type: 'input_uncached' },
      { model: 'm', token_type: 'output' },
      { model: 'm', token_type: 'cache_read' },
      { model: 'm', token_type: 'cache_write' }
    ]);
  });

  it.each(['constructor', '__proto__', 'toString', 'bogus'])(
    'drops the token type %s instead of resolving the prototype',
    type => {
      let [mapped] = mapMetric('token.usage', 1, { type });

      expect(mapped?.draft.data?.['dims']).toEqual({});
    }
  );

  it('maps edit decisions and line operations', () => {
    expect(
      mapMetric('code_edit_tool.decision', 1, { tool_name: 'Edit', decision: 'reject' })[0]
        ?.draft.data?.['dims']
    ).toEqual({ tool_name: 'Edit', decision: 'deny' });
    expect(
      mapMetric('lines_of_code.count', 5, { type: 'added' })[0]?.draft.data?.['dims']
    ).toEqual({
      line_op: 'added'
    });
  });

  it('flags unrecognized attributes by name only', () => {
    let [mapped] = mapMetric('cost.usage', 1, {
      model: 'm',
      'secret.attr': 'SENTINEL',
      'session.id': 's'
    });

    expect(mapped?.draft.dropped).toEqual(['attr:secret.attr']);
    expect(JSON.stringify({ ...mapped?.draft, identity: '' })).not.toContain('SENTINEL');
  });

  it('carries the session id as context', () => {
    expect(mapMetric('session.count', 1, { 'session.id': 'abc' })[0]?.draft.ctx).toEqual({
      sessionId: 'abc'
    });
  });

  it('suppresses unknown metrics, prototype names and empty values', () => {
    expect(mapMetric('something.else', 1)).toEqual([]);
    expect(mapMetric('constructor', 1)).toEqual([]);
    expect(mapMetric('__proto__', 1)).toEqual([]);
    expect(mapMetric('session.count', null)).toEqual([]);
    expect(mapMetric('session.count', Number.NaN)).toEqual([]);
  });

  it('keeps distinct identities per time window', () => {
    let a = claudeCodeOtlp.mapMetric!(ctx('metrics'), metricPoint('session.count', 1))[0]!;
    let b = claudeCodeOtlp.mapMetric!(
      ctx('metrics'),
      metricPoint('session.count', 1, {}, { timeNs: nanosOf('2026-06-15T12:00:00.000Z') })
    )[0]!;

    expect(a.draft.identity).not.toBe(b.draft.identity);
  });
});

describe('claudeCodeOtlp spans', () => {
  it('maps interactions as turn completions', () => {
    expect(
      mapSpan('claude_code.interaction', {
        'prompt.id': 'p-1',
        user_prompt_length: 30,
        'session.id': 's'
      })
    ).toMatchObject({
      type: 'turn.completed',
      role: 'supplemental',
      factKey: 'turn:{session_key}:p-1',
      durationMs: 2000,
      occurredAt: new Date('2026-06-15T11:59:28.000Z'),
      identity: 'span|0af7651916cd43dd8448eb211c80319c|b7ad6b7169203331',
      ctx: { sessionId: 's', turnId: 'p-1' },
      data: { outcome: 'ok', prompt_length_chars: 30 }
    });
    expect(mapSpan('interaction', {}, { statusCode: 2 }).data).toMatchObject({
      outcome: 'error'
    });
  });

  it('maps llm requests with usage and errors', () => {
    expect(
      mapSpan('claude_code.llm_request', {
        request_id: 'r',
        model: 'm',
        input_tokens: 10,
        output_tokens: 5,
        ttft_ms: 300,
        stop_reason: 'end_turn',
        attempt: 1,
        speed: 'standard',
        effort: 'low'
      })
    ).toMatchObject({
      type: 'model.request',
      factKey: 'req:{session_key}:r',
      data: {
        outcome: 'ok',
        usage: { input_uncached: 10, output: 5 },
        ttft_ms: 300,
        stop_reason: 'end_turn',
        speed: 'standard',
        effort: 'low'
      }
    });

    expect(
      mapSpan('llm_request', {
        success: false,
        status_code: 529,
        error_class: 'overloaded_error'
      }).data
    ).toMatchObject({
      outcome: 'error',
      error: { class: 'overloaded', native_type: 'overloaded_error', status_code: 529 }
    });
    expect(mapSpan('llm_request', {}, { statusCode: 2 }).data).toMatchObject({
      outcome: 'error',
      error: { class: 'unknown' }
    });
  });

  it('maps tool executions with agent context', () => {
    let draft = mapSpan('claude_code.tool.execution', {
      tool_use_id: 'tu',
      tool_name: 'Edit',
      success: false,
      error_class: 'PermissionError',
      agent_id: 'a-2',
      parent_agent_id: 'a-1'
    });

    expect(draft).toMatchObject({
      type: 'tool.call',
      factKey: 'tool:{session_key}:tu',
      ctx: { agent: { id: 'a-2', parentId: 'a-1' }, toolCallId: 'tu' },
      data: {
        tool: { name: 'Edit' },
        outcome: 'error',
        error: { class: 'tool', native_type: 'PermissionError' },
        duration_ms: 2000
      }
    });
    expect(mapSpan('claude_code.tool', {}).type).toBe('tool.call');
  });

  it('maps user blocking waits and hooks', () => {
    expect(
      mapSpan('claude_code.tool.blocked_on_user', {
        tool_use_id: 'tu',
        decision: 'accept',
        source: 'user_temporary'
      })
    ).toMatchObject({
      type: 'tool.decision',
      data: { decision: { value: 'allow', scope: 'session' }, wait_ms: 2000 }
    });

    expect(mapSpan('claude_code.hook')).toMatchObject({
      type: 'hook.run',
      data: { duration_ms: 2000 }
    });
  });

  it('falls back to the duration attribute without usable timestamps', () => {
    let draft = mapSpan('hook', { duration_ms: 77 }, { startNs: 0n, endNs: 0n });

    expect(draft.durationMs).toBe(77);
    expect(draft.occurredAt).toBeNull();
  });

  it('keeps unknown spans as diagnostics', () => {
    expect(mapSpan('claude_code.something', {})).toMatchObject({
      type: 'unmapped',
      data: { native_name: 'something', category: 'diagnostic' }
    });
    expect(mapSpan('GET https://SENTINEL.example/x')).toMatchObject({
      signalName: 'unknown',
      data: { native_name: 'unknown' }
    });
  });

  it('omits trace and agent context when ids are empty', () => {
    let draft = mapSpan('hook', {}, { traceId: '', spanId: '' });

    expect(draft.ctx).not.toHaveProperty('agent');
    expect(draft.ctx?.trace).toBeUndefined();
  });
});

describe('claudeCodeOtlp through buildRecord', () => {
  it('builds valid records for logs, metrics and spans', () => {
    let logs = mapLog('api_request', { request_id: 'r', input_tokens: 5 });
    let metrics = mapMetric('token.usage', 5, { type: 'input' });
    let spans = claudeCodeOtlp.mapSpan!(ctx('traces'), spanOf('claude_code.interaction'));

    for (let mapped of [...logs, ...metrics, ...spans]) {
      let record = buildMapped(mapped, { route: 'otlp_http' });

      expect(record.source.adapter).toBe('claude-code');
      expect(record.id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('is deterministic for identical inputs', () => {
    let a = buildMapped(mapLog('user_prompt', { prompt: 'x' })[0]!);
    let b = buildMapped(mapLog('user_prompt', { prompt: 'x' })[0]!);

    expect(a).toEqual(b);
  });
});
