import { describe, expect, it } from 'vitest';
import type { ContentPolicy, NormalizedRecord } from '@metorial/groundstation-spec';
import { buildMapped, unitPrincipal } from '../../test/build';
import { groupOf, logRecord, metricPoint, spanOf } from '../../test/otlp';
import type {
  OtlpAttributes,
  OtlpGroup,
  OtlpLogRecord,
  OtlpMetricPoint,
  OtlpSpan
} from '../../otlp/model';
import { claudeCodeHooks, codexHooks, createGenericHooks } from '../../dialects/hooks';
import { claudeHookPayloads, hookTime, sentinel } from '../../dialects/hooks/tests/fixtures';
import { claudeCodeOtlp } from '../../dialects/otlp/claudeCode';
import { codexOtlp } from '../../dialects/otlp/codex';
import { genAiOtlp } from '../../dialects/otlp/genai';
import { quarantineOtlp } from '../../dialects/otlp/quarantine';
import { mapOtlpGroup } from '../../dialects/registry';
import type { Mapped, OtlpDialect } from '../../dialects/types';

type Fixture = { name: string; mapped: Mapped[]; carriesContent: boolean };

type LooseEntry = NormalizedRecord['content'][number] & { text?: string };

let poison: OtlpAttributes = {
  cwd: `/Users/dev/code/${sentinel}`,
  transcript_path: `/Users/dev/.claude/${sentinel}.jsonl`,
  'file.path': `/src/${sentinel}.ts`,
  'http.url': `https://example.test/${sentinel}?q=${sentinel}`,
  'server.address': `${sentinel}.example.test`,
  message: `message ${sentinel}`,
  rationale: `rationale ${sentinel}`,
  command: `echo ${sentinel}`,
  stack: `Error: ${sentinel}\n  at x`,
  'exception.message': `${sentinel} failed`,
  'gen_ai.input.messages': `[{"role":"user","content":"${sentinel}"}]`,
  'gen_ai.output.messages': `[{"role":"assistant","content":"${sentinel}"}]`,
  'gen_ai.system_instructions': `system ${sentinel}`,
  'gen_ai.tool.definitions': `[{"name":"${sentinel}"}]`,
  'gen_ai.prompt': `prompt ${sentinel}`,
  'gen_ai.completion': `completion ${sentinel}`
};

let richPrompt = `see https://example.com/${sentinel}\n\`\`\`ts\nlet ${sentinel} = 1;\n\`\`\`\nthanks`;

let hookFixtures = (): Fixture[] => {
  let fixtures: Fixture[] = [];

  let dialects = [
    { label: 'claude-code', dialect: claudeCodeHooks },
    { label: 'codex', dialect: codexHooks },
    { label: 'generic', dialect: createGenericHooks('some-client') }
  ];

  for (let { label, dialect } of dialects) {
    for (let [event, payload] of Object.entries(claudeHookPayloads)) {
      let enriched = { ...poison, ...payload };

      fixtures.push({
        name: `hook:${label}:${event}`,
        mapped: dialect.map({ identityHint: 'h1', occurredAt: hookTime }, enriched),
        carriesContent: label != 'generic' && contentEvents.has(event)
      });
    }

    fixtures.push({
      name: `hook:${label}:rich-prompt`,
      mapped: dialect.map(
        { identityHint: 'h2', occurredAt: hookTime },
        { ...poison, hook_event_name: 'UserPromptSubmit', session_id: 's', prompt: richPrompt }
      ),
      carriesContent: label != 'generic'
    });

    fixtures.push({
      name: `hook:${label}:no-event-name`,
      mapped: dialect.map({ identityHint: 'h3' }, { ...poison, session_id: 's' }),
      carriesContent: false
    });
  }

  return fixtures;
};

let contentEvents = new Set([
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PermissionDenied',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'StopFailure',
  'SubagentStop'
]);

let claudeResource: OtlpAttributes = {
  'service.name': 'claude-code',
  'service.version': '2.1.0',
  'process.command_line': `claude --resume ${sentinel}`,
  'process.working_directory': `/Users/dev/${sentinel}`
};

let codexResource: OtlpAttributes = {
  ...claudeResource,
  'service.name': 'codex_cli_rs',
  'process.command_line': `codex ${sentinel}`
};

let genAiResource: OtlpAttributes = { ...claudeResource, 'service.name': 'my-agent' };

let unknownResource: OtlpAttributes = { ...claudeResource, 'service.name': 'mystery' };

let jsonText = (value: unknown) => JSON.stringify(value);

let toolParameters = jsonText({ command: `cat ${sentinel}.txt`, description: sentinel });

let otlpFixture = (
  name: string,
  dialect: OtlpDialect,
  run: () => ReturnType<typeof mapOtlpGroup>,
  carriesContent: boolean
): Fixture => {
  let result = run();

  expect(result.dialect).toBe(dialect);
  expect(result.failed).toBe(0);

  return { name, mapped: result.mapped, carriesContent };
};

let logsFixture = (
  name: string,
  dialect: OtlpDialect,
  resource: OtlpAttributes,
  attributes: OtlpAttributes,
  carriesContent: boolean,
  overrides: Partial<OtlpLogRecord> = {}
) =>
  otlpFixture(
    `logs:${name}`,
    dialect,
    () =>
      mapOtlpGroup(
        'logs',
        groupOf([logRecord({ ...poison, ...attributes }, overrides)], resource)
      ),
    carriesContent
  );

let metricFixture = (
  name: string,
  dialect: OtlpDialect,
  resource: OtlpAttributes,
  point: OtlpMetricPoint
) =>
  otlpFixture(
    `metrics:${name}`,
    dialect,
    () =>
      mapOtlpGroup(
        'metrics',
        groupOf([{ ...point, attributes: { ...poison, ...point.attributes } }], resource)
      ),
    false
  );

let spanFixture = (
  name: string,
  dialect: OtlpDialect,
  resource: OtlpAttributes,
  span: OtlpSpan
) =>
  otlpFixture(
    `traces:${name}`,
    dialect,
    () =>
      mapOtlpGroup(
        'traces',
        groupOf(
          [{ ...span, attributes: { ...poison, ...span.attributes } }],
          resource
        ) as OtlpGroup<OtlpSpan>
      ),
    false
  );

let claudeFixtures = (): Fixture[] => {
  let ev = (event: string, attributes: OtlpAttributes = {}, carries = false) =>
    logsFixture(
      `claude:${event}`,
      claudeCodeOtlp,
      claudeResource,
      { 'event.name': event, 'session.id': 's-1', 'prompt.id': 'p-1', ...attributes },
      carries
    );

  return [
    ev('api_request', {
      request_id: 'r',
      model: 'm',
      input_tokens: 5,
      output_tokens: 2,
      cost_usd: 0.1
    }),
    ev('api_error', { request_id: 'r', status_code: 500, error: `boom ${sentinel}` }, true),
    ev('api_retries_exhausted', { status_code: 529, error: `boom ${sentinel}` }, true),
    ev('api_refusal', { model: 'm', category: 'x' }),
    ev('tool_decision', {
      tool_name: 'Bash',
      decision: 'accept',
      source: 'config',
      tool_use_id: 't'
    }),
    ev(
      'tool_result',
      {
        tool_name: 'Bash',
        success: false,
        tool_use_id: 't',
        tool_parameters: toolParameters,
        tool_input: { command: `rm -rf ${sentinel}` },
        error: `exit 1 ${sentinel}`,
        tool_result: sentinel
      },
      true
    ),
    ev(
      'tool_result',
      {
        tool_name: 'Read',
        success: true,
        tool_parameters: jsonText({ file_path: `/x/${sentinel}.ts` })
      },
      true
    ),
    ev('user_prompt', { prompt: richPrompt, prompt_length: richPrompt.length }, true),
    ev('assistant_response', { response: `done ${sentinel}`, response_length: 20 }, true),
    ev('permission_mode_changed', { from_mode: 'default', to_mode: 'plan' }),
    ev('auth', { action: 'login', success: false, error_category: 'network' }),
    ev('mcp_server_connection', {
      status: 'failed',
      server_name: 'github',
      server_url: `https://${sentinel}.test`
    }),
    ev('internal_error', { error_name: 'TypeError', error_code: 3 }),
    ev('compaction', { trigger: 'auto', success: true, pre_tokens: 10, post_tokens: 5 }),
    ev('subagent_completed', { agent_type: 'explore', total_tokens: 100 }),
    ev('skill_activated', { 'skill.name': 'pdf', 'skill.description': sentinel }),
    ev('hook_execution_complete', { hook_event: 'PreToolUse', num_hooks: 1 }),
    ev('plugin_installed'),
    ev('plugin_loaded'),
    ev('brand_new_event', { body_text: sentinel }),
    logsFixture('claude:bodyless', claudeCodeOtlp, claudeResource, {}, false, {
      body: `claude_code.user_prompt ${sentinel}`
    }),
    ...[
      'session.count',
      'lines_of_code.count',
      'pull_request.count',
      'commit.count',
      'cost.usage',
      'token.usage',
      'code_edit_tool.decision',
      'active_time.total'
    ].map(name =>
      metricFixture(
        `claude:${name}`,
        claudeCodeOtlp,
        claudeResource,
        metricPoint(`claude_code.${name}`, 3, { type: 'input', model: 'm' })
      )
    ),
    ...[
      'interaction',
      'llm_request',
      'tool',
      'tool.execution',
      'tool.blocked_on_user',
      'hook',
      'mystery'
    ].map(name =>
      spanFixture(
        `claude:${name}`,
        claudeCodeOtlp,
        claudeResource,
        spanOf(`claude_code.${name}`, {
          user_prompt: sentinel,
          tool_input: sentinel,
          tool_name: 'Bash',
          tool_use_id: 't',
          input_tokens: 3
        })
      )
    )
  ];
};

let codexFixtures = (): Fixture[] => {
  let ev = (event: string, attributes: OtlpAttributes = {}, carries = false) =>
    logsFixture(
      `codex:${event}`,
      codexOtlp,
      codexResource,
      { 'event.name': event, 'conversation.id': 'c-1', 'turn.id': 't-1', ...attributes },
      carries
    );

  return [
    ev('conversation_starts', {
      model: 'gpt-5',
      provider_name: 'openai',
      instructions: sentinel
    }),
    ev(
      'api_request',
      { 'http.response.status_code': 500, 'error.message': `bad ${sentinel}` },
      true
    ),
    ev('sse_event', {
      'event.kind': 'response.completed',
      input_token_count: 10,
      output_token_count: 4,
      text: sentinel
    }),
    ev('sse_event', { 'event.kind': 'response.output_text.delta', delta: sentinel }),
    ev('user_prompt', { prompt: richPrompt, prompt_length: richPrompt.length }, true),
    ev('tool_decision', {
      tool_name: 'shell',
      decision: 'approved',
      source: 'User',
      call_id: 'k'
    }),
    ev('sandbox_outcome', { tool_name: 'shell', outcome: 'escalated', call_id: 'k' }),
    ev(
      'tool_result',
      {
        tool_name: 'shell',
        call_id: 'k',
        success: true,
        arguments: jsonText({ command: ['bash', '-lc', `cat ${sentinel}`] }),
        output: `out ${sentinel}`
      },
      true
    ),
    ev('agent_response', { response: `final ${sentinel}`, response_length: 15 }, true),
    ev('guardian_assessment', {
      status: 'done',
      outcome: 'allow',
      risk_level: 'low',
      rationale: `because ${sentinel}`
    }),
    ev('skill_invocation', { 'skill.name': 'pdf' }),
    ev('turn_cost', { 'usage.estimated_usd': 0.5 }),
    ev('turn_cost', { 'usage.estimated_usd': 'n/a', note: sentinel }),
    ev('retry', { 'retry.attempt': 1, 'retry.delay_ms': 100 }),
    ev('network_proxy.policy_decision', {
      'network.policy.decision': 'deny',
      'network.policy.host': `${sentinel}.test`
    }),
    ev('brand_new_event'),
    ...[
      'tool.call',
      'tool.call.duration_ms',
      'api_request',
      'api_request.duration_ms',
      'turn.token_usage',
      'turn.ttft.duration_ms',
      'thread.started',
      'turn.cost_microusd'
    ].map(name =>
      metricFixture(
        `codex:${name}`,
        codexOtlp,
        codexResource,
        metricPoint(`codex.${name}`, 5, { token_type: 'input', tool: 'shell', success: true })
      )
    ),
    ...[
      'session_task.turn',
      'session_task.compact',
      'handle_responses',
      'mcp.tools.call',
      'mystery.span'
    ].map(name =>
      spanFixture(
        `codex:${name}`,
        codexOtlp,
        codexResource,
        spanOf(name, {
          'tool.name': 'search',
          'tool.call_id': 'k',
          'mcp.server.name': 'github',
          'mcp.tool.arguments': sentinel,
          'gen_ai.usage.input_tokens': 5,
          'codex.turn.token_usage.input_tokens': 5
        })
      )
    )
  ];
};

let genAiFixtures = (): Fixture[] => [
  ...[
    'chat gpt-4o',
    'execute_tool search',
    'invoke_agent planner',
    'text_completion x',
    'embeddings e',
    'retrieval r'
  ].map(name =>
    spanFixture(
      `genai:${name}`,
      genAiOtlp,
      genAiResource,
      spanOf(name, {
        'gen_ai.operation.name': name.split(' ')[0] ?? '',
        'gen_ai.request.model': 'm',
        'gen_ai.usage.input_tokens': 7,
        'gen_ai.tool.name': 'Bash',
        'gen_ai.tool.call.arguments': `{"command":"${sentinel}"}`,
        'gen_ai.tool.call.result': sentinel,
        'gen_ai.agent.description': sentinel,
        'gen_ai.conversation.id': 'conv'
      })
    )
  ),
  spanFixture(
    'genai:failed',
    genAiOtlp,
    genAiResource,
    spanOf('chat m', { 'error.type': 'timeout' }, { statusCode: 2, statusMessage: sentinel })
  ),
  ...[
    ['gen_ai.client.token.usage', { 'gen_ai.token.type': 'input' }],
    ['gen_ai.client.operation.duration', {}],
    ['gen_ai.client.operation.time_to_first_chunk', {}]
  ].map(([name, attributes]) =>
    metricFixture(
      `genai:${name as string}`,
      genAiOtlp,
      genAiResource,
      metricPoint(name as string, 2, attributes as OtlpAttributes)
    )
  ),
  logsFixture(
    'genai:details',
    genAiOtlp,
    genAiResource,
    { 'event.name': 'gen_ai.client.inference.operation.details' },
    false,
    { body: { messages: sentinel }, eventName: 'gen_ai.client.inference.operation.details' }
  )
];

let quarantineFixtures = (): Fixture[] => [
  logsFixture(
    'quarantine:text-body',
    quarantineOtlp,
    unknownResource,
    { a: sentinel },
    false,
    {
      body: `user typed: ${sentinel}`
    }
  ),
  logsFixture('quarantine:structured-body', quarantineOtlp, unknownResource, {}, false, {
    body: { text: sentinel, nested: [sentinel] }
  }),
  logsFixture('quarantine:event-name', quarantineOtlp, unknownResource, {}, false, {
    body: '',
    eventName: 'some.event'
  }),
  metricFixture(
    'quarantine:metric',
    quarantineOtlp,
    unknownResource,
    metricPoint('some.metric', 1, { a: sentinel })
  ),
  spanFixture(
    'quarantine:span',
    quarantineOtlp,
    unknownResource,
    spanOf(`GET /${sentinel}`, { 'http.target': sentinel })
  )
];

let allFixtures = () => [
  ...hookFixtures(),
  ...claudeFixtures(),
  ...codexFixtures(),
  ...genAiFixtures(),
  ...quarantineFixtures()
];

let policies: [string, ContentPolicy][] = [
  ['basic', { defaultMode: 'basic' }],
  ['shape', { defaultMode: 'shape' }],
  ['full', { defaultMode: 'full' }],
  [
    'mixed',
    {
      defaultMode: 'basic',
      roles: { prompt: 'full', tool_input: 'shape', response: 'shape', error_message: 'full' }
    }
  ]
];

let build = (fixture: Fixture, policy: ContentPolicy) =>
  fixture.mapped.map(mapped =>
    buildMapped(mapped, { principal: unitPrincipal({ contentPolicy: policy }) })
  );

let withoutContent = (record: NormalizedRecord) => JSON.stringify({ ...record, content: [] });

let fixtures = allFixtures();

describe('privacy sentinel fixtures', () => {
  it('cover every dialect and a meaningful number of records', () => {
    let names = fixtures.map(fixture => fixture.name);

    for (let prefix of [
      'hook:claude-code:',
      'hook:codex:',
      'hook:generic:',
      'logs:claude:',
      'metrics:claude:',
      'traces:claude:',
      'logs:codex:',
      'metrics:codex:',
      'traces:codex:',
      'traces:genai:',
      'metrics:genai:',
      'logs:genai:',
      'logs:quarantine:',
      'metrics:quarantine:',
      'traces:quarantine:'
    ]) {
      expect(
        names.some(name => name.startsWith(prefix)),
        prefix
      ).toBe(true);
    }

    expect(fixtures.reduce((sum, fixture) => sum + fixture.mapped.length, 0)).toBeGreaterThan(
      150
    );
  });

  it('actually feed the sentinel through the mappers', () => {
    let carriers = fixtures.filter(fixture => fixture.carriesContent);

    expect(carriers.length).toBeGreaterThanOrEqual(30);

    for (let fixture of carriers) {
      let fed = fixture.mapped.some(mapped =>
        (mapped.draft.content ?? []).some(input =>
          JSON.stringify(input.value ?? '').includes(sentinel)
        )
      );

      expect(fed, fixture.name).toBe(true);
    }
  });
});

describe('drafts never carry content outside the content inputs', () => {
  it.each(fixtures.map(fixture => [fixture.name, fixture] as const))(
    '%s',
    (_name, fixture) => {
      for (let { draft } of fixture.mapped) {
        let visible = JSON.stringify({ ...draft, identity: '', content: undefined });

        expect(visible).not.toContain(sentinel);
      }
    }
  );
});

describe.each(policies)('records under the %s policy', (_label, policy) => {
  let mode = policy.defaultMode;

  it.each(fixtures.map(fixture => [fixture.name, fixture] as const))(
    '%s',
    (_name, fixture) => {
      for (let record of build(fixture, policy)) {
        expect(withoutContent(record)).not.toContain(sentinel);

        for (let entry of record.content as LooseEntry[]) {
          let { text, ...metadata } = entry;

          expect(JSON.stringify(metadata)).not.toContain(sentinel);

          let allowedFull =
            mode == 'full'
              ? true
              : policy.roles?.[entry.role as keyof typeof policy.roles] == 'full';

          if (!allowedFull) {
            expect(text).toBeUndefined();
          } else if (entry.mode != 'full') {
            expect(text).toBeUndefined();
          }
        }
      }
    }
  );
});

describe('basic and shape policies never expose raw content', () => {
  it.each(['basic', 'shape'] as const)(
    '%s serializes without the sentinel anywhere',
    defaultMode => {
      let policy: ContentPolicy = { defaultMode };
      let records = fixtures.flatMap(fixture => build(fixture, policy));

      expect(records.length).toBeGreaterThan(150);

      for (let record of records) {
        expect(JSON.stringify(record)).not.toContain(sentinel);
      }
    }
  );

  it('keeps content entries as length and keyed hash under basic', () => {
    let entries = fixtures
      .filter(fixture => fixture.carriesContent)
      .flatMap(fixture => build(fixture, { defaultMode: 'basic' }))
      .flatMap(record => record.content);

    expect(entries.length).toBeGreaterThan(30);

    for (let entry of entries) {
      expect(entry).not.toHaveProperty('text');
      expect(entry).not.toHaveProperty('shape');
      expect(['present', 'redacted_by_client', 'length_only']).toContain(entry.state);
    }
  });
});

describe('full policy confines content to content entries', () => {
  it('shows the sentinel only inside content text', () => {
    let policy: ContentPolicy = { defaultMode: 'full' };
    let seenInText = 0;

    for (let fixture of fixtures) {
      for (let record of build(fixture, policy)) {
        expect(withoutContent(record)).not.toContain(sentinel);

        for (let entry of record.content as LooseEntry[]) {
          if (entry.text?.includes(sentinel)) seenInText++;
        }
      }
    }

    expect(seenInText).toBeGreaterThan(30);
  });

  it('keeps the rich prompt shape free of its text', () => {
    let fixture = fixtures.find(f => f.name == 'hook:claude-code:rich-prompt')!;
    let [record] = build(fixture, { defaultMode: 'shape' });

    expect(record?.content[0]?.shape).toMatchObject({ code_blocks: 1, urls: 1 });
    expect(JSON.stringify(record)).not.toContain(sentinel);
  });

  it('downgrades roles that must never be stored in full', () => {
    let records = fixtures.flatMap(fixture => build(fixture, { defaultMode: 'full' }));

    for (let entry of records.flatMap(record => record.content) as LooseEntry[]) {
      if (['system_prompt', 'raw_request', 'raw_response'].includes(entry.role)) {
        expect(entry.text).toBeUndefined();
      }
    }
  });
});

describe('quarantine naming', () => {
  it('keeps free-text bodies out of the signal name', () => {
    let fixture = fixtures.find(f => f.name == 'logs:quarantine:text-body')!;

    for (let record of build(fixture, { defaultMode: 'full' })) {
      expect(record.source.signal_name).toBe('unknown');
      expect(JSON.stringify(record)).not.toContain(sentinel);
    }
  });

  it('records identifier-shaped bodies as the signal name by design', () => {
    let group = groupOf([logRecord({}, { body: 'my.event_name' })], unknownResource);
    let [mapped] = mapOtlpGroup('logs', group).mapped;

    expect(buildMapped(mapped!).source.signal_name).toBe('my.event_name');
  });
});
