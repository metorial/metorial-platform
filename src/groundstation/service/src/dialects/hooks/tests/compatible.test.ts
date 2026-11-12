import { describe, expect, it } from 'vitest';
import { buildMapped } from '../../../test/build';
import { claudeCodeHooks, codexHooks } from '../index';
import { claudeHookPayloads, hookTime, sentinel } from './fixtures';

let context = { identityHint: 'hint-1', occurredAt: hookTime };

let mapOne = (payload: Record<string, unknown>, dialect = claudeCodeHooks) => {
  let mapped = dialect.map(context, payload);

  expect(mapped).toHaveLength(1);

  return mapped[0]!;
};

let draftOf = (payload: Record<string, unknown>, dialect = claudeCodeHooks) =>
  mapOne(payload, dialect).draft;

describe('dialect identities', () => {
  it('exposes stable ids', () => {
    expect([claudeCodeHooks.id, claudeCodeHooks.adapter, claudeCodeHooks.client]).toEqual([
      'claude-code.hooks.v1',
      'claude-code',
      'claude-code'
    ]);
    expect([codexHooks.id, codexHooks.adapter, codexHooks.client]).toEqual([
      'codex.hooks.v1',
      'codex',
      'codex'
    ]);
  });

  it('stamps the source and client family', () => {
    let mapped = mapOne(claudeHookPayloads['SessionStart']!, codexHooks);

    expect(mapped.source).toEqual({
      adapter: 'codex',
      dialect: 'codex.hooks.v1',
      channel: 'hook'
    });
    expect(mapped.draft.client).toEqual({ family: 'codex' });
  });
});

describe('session events', () => {
  it('maps SessionStart with start type and model', () => {
    let draft = draftOf(claudeHookPayloads['SessionStart']!);

    expect(draft).toMatchObject({
      kind: 'event',
      type: 'session.start',
      signalName: 'SessionStart',
      occurredAt: hookTime,
      ctx: { sessionId: 'sess-123' },
      data: { start_type: 'fresh', model: 'claude-sonnet-4-5' }
    });
  });

  it.each([
    ['startup', 'fresh'],
    ['clear', 'fresh'],
    ['resume', 'resume'],
    ['compact', 'continue'],
    ['fork', 'fork']
  ])('maps the start source %s', (source, startType) => {
    expect(
      draftOf({ hook_event_name: 'SessionStart', session_id: 's', source }).data
    ).toMatchObject({ start_type: startType });
  });

  it('keeps unknown start sources as native labels', () => {
    let draft = draftOf({
      hook_event_name: 'SessionStart',
      session_id: 's',
      source: 'teleport'
    });

    expect(draft.data).toEqual({ native: { source: 'teleport' } });
  });

  it('survives a session start without a source', () => {
    expect(draftOf({ hook_event_name: 'SessionStart', session_id: 's' }).data).toEqual({});
  });

  it('maps SessionEnd with a reason', () => {
    expect(draftOf(claudeHookPayloads['SessionEnd']!)).toMatchObject({
      type: 'session.end',
      data: { reason: 'prompt_input_exit' }
    });
    expect(draftOf({ hook_event_name: 'SessionEnd' }).data).toEqual({});
  });

  it('only records the model on session start', () => {
    let draft = draftOf({ hook_event_name: 'Stop', model: 'm', session_id: 's' });

    expect(draft.data).not.toHaveProperty('model');
  });
});

describe('prompt events', () => {
  it('maps a prompt with content and a character count', () => {
    let draft = draftOf(claudeHookPayloads['UserPromptSubmit']!);

    expect(draft).toMatchObject({
      type: 'prompt.submitted',
      ctx: { turnId: 'prompt-9' },
      data: { length_chars: `please fix ${sentinel}`.length },
      content: [{ role: 'prompt', value: `please fix ${sentinel}` }]
    });
  });

  it('records no content for an empty or missing prompt', () => {
    expect(draftOf({ hook_event_name: 'UserPromptSubmit', prompt: '' }).content).toEqual([]);
    expect(draftOf({ hook_event_name: 'UserPromptSubmit' }).content).toEqual([]);
    expect(draftOf({ hook_event_name: 'UserPromptSubmit', prompt: 5 }).content).toEqual([]);
  });

  it('maps a command expansion without its arguments', () => {
    let draft = draftOf(claudeHookPayloads['UserPromptExpansion']!);

    expect(draft).toMatchObject({
      type: 'command.invoked',
      data: { name: 'review', source: 'project' }
    });
    expect(JSON.stringify(draft)).not.toContain(sentinel);
  });
});

describe('tool events', () => {
  it('maps PreToolUse as a supplemental requested record', () => {
    let draft = draftOf(claudeHookPayloads['PreToolUse']!);

    expect(draft).toMatchObject({
      type: 'tool.requested',
      role: 'supplemental',
      factKey: 'tool:{session_key}:toolu_01',
      ctx: { toolCallId: 'toolu_01' },
      data: { tool: { name: 'Bash', kind: 'shell', class: 'shell' } },
      content: [{ role: 'tool_input', hints: { tool: 'Bash' } }]
    });
  });

  it('has no fact key without a tool use id', () => {
    let draft = draftOf({ hook_event_name: 'PreToolUse', tool_name: 'Read', session_id: 's' });

    expect(draft.factKey).toBeNull();
  });

  it('maps tool use id aliases', () => {
    let draft = draftOf({
      hookEventName: 'PreToolUse',
      sessionId: 's',
      toolName: 'Read',
      toolUseId: 'camel-1',
      toolInput: { file_path: 'a.ts' }
    });

    expect(draft.factKey).toBe('tool:{session_key}:camel-1');
    expect(draft.ctx?.sessionId).toBe('s');
    expect(draft.content).toHaveLength(1);
  });

  it('maps a permission request as an ask decision', () => {
    let draft = draftOf(claudeHookPayloads['PermissionRequest']!);

    expect(draft).toMatchObject({
      type: 'tool.decision',
      data: {
        tool: { name: 'Edit', class: 'file_edit' },
        decision: { value: 'ask', source: 'unknown', scope: 'none', automatic: false }
      }
    });
    expect(draft.content?.map(entry => entry.role)).toEqual(['tool_input']);
  });

  it('maps a denied permission with the reason as error content', () => {
    let draft = draftOf(claudeHookPayloads['PermissionDenied']!);

    expect(draft.data?.['decision']).toMatchObject({ value: 'deny' });
    expect(draft.content?.map(entry => entry.role)).toEqual(['tool_input', 'error_message']);
  });

  it('maps a successful tool call', () => {
    let draft = draftOf(claudeHookPayloads['PostToolUse']!);

    expect(draft).toMatchObject({
      type: 'tool.call',
      durationMs: 42,
      data: { tool: { name: 'Read', class: 'file_read' }, outcome: 'ok', duration_ms: 42 }
    });
    expect(draft.content?.map(entry => entry.role)).toEqual(['tool_input', 'tool_output']);
    expect(draft.data).not.toHaveProperty('error');
  });

  it('maps a failed tool call with a coerced duration', () => {
    let draft = draftOf(claudeHookPayloads['PostToolUseFailure']!);

    expect(draft).toMatchObject({
      durationMs: 17,
      data: { outcome: 'error', error: { class: 'tool' } },
      coerced: ['payload.duration_ms']
    });
    expect(draft.content?.map(entry => entry.role)).toEqual(['tool_input', 'error_message']);
  });

  it('maps an interrupted failure as cancelled', () => {
    let draft = draftOf({
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_use_id: 't',
      is_interrupt: true,
      error: 'killed'
    });

    expect(draft.data).toMatchObject({ outcome: 'cancelled' });
    expect(draft.data).not.toHaveProperty('error');
  });

  it('does not treat a non-boolean interrupt flag as an interrupt', () => {
    let draft = draftOf({
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      is_interrupt: 'maybe'
    });

    expect(draft.data).toMatchObject({ outcome: 'error' });
  });

  it('classifies MCP tools from the name and from the server hint', () => {
    let fromName = draftOf({
      hook_event_name: 'PostToolUse',
      tool_name: 'mcp__github__create_issue'
    });
    let fromHint = draftOf({
      hook_event_name: 'PostToolUse',
      tool_name: 'search',
      mcp_server: { name: 'docs' }
    });

    expect(fromName.data?.['tool']).toMatchObject({
      kind: 'mcp',
      mcp: { server: 'github', tool: 'create_issue' }
    });
    expect(fromHint.data?.['tool']).toMatchObject({
      kind: 'mcp',
      mcp: { server: 'docs', tool: 'search' }
    });
  });

  it('omits the tool without a tool name', () => {
    expect(draftOf({ hook_event_name: 'PostToolUse' }).data).not.toHaveProperty('tool');
    expect(draftOf({ hook_event_name: 'PostToolUse', tool_name: 12 }).data).not.toHaveProperty(
      'tool'
    );
  });

  it('ignores a negative or fractional duration', () => {
    expect(
      draftOf({ hook_event_name: 'PostToolUse', tool_name: 'x', duration_ms: -5 }).durationMs
    ).toBeUndefined();
    expect(
      draftOf({ hook_event_name: 'PostToolUse', tool_name: 'x', duration_ms: 2.9 }).durationMs
    ).toBe(2);
  });
});

describe('turn events', () => {
  it('maps Stop to a completed turn plus the final assistant message', () => {
    let mapped = claudeCodeHooks.map(context, claudeHookPayloads['Stop']!);

    expect(mapped.map(entry => entry.draft.type)).toEqual([
      'turn.completed',
      'message.assistant'
    ]);

    let [turn, message] = mapped.map(entry => entry.draft);

    expect(turn).toMatchObject({
      factKey: 'turn:{session_key}:turn-3',
      data: { outcome: 'ok' }
    });
    expect(message).toMatchObject({
      data: { length_chars: `done ${sentinel}`.length, final: true },
      content: [{ role: 'response', value: `done ${sentinel}` }]
    });
    expect(message!.identity).not.toBe(turn!.identity);
  });

  it('maps Stop without a message to only the turn', () => {
    let mapped = claudeCodeHooks.map(context, { hook_event_name: 'Stop', session_id: 's' });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.draft.factKey).toBeNull();
  });

  it('treats an empty assistant message as absent', () => {
    let mapped = claudeCodeHooks.map(context, {
      hook_event_name: 'Stop',
      last_assistant_message: ''
    });

    expect(mapped).toHaveLength(1);
  });

  it.each([
    ['rate_limit', 'rate_limit'],
    ['overloaded', 'overloaded'],
    ['authentication_failed', 'auth'],
    ['billing_error', 'auth'],
    ['invalid_request', 'invalid_request'],
    ['max_output_tokens', 'invalid_request'],
    ['server_error', 'server'],
    ['unknown', 'unknown'],
    ['something_else', 'unknown']
  ])('maps the stop failure %s to class %s', (error, errorClass) => {
    let draft = draftOf({ hook_event_name: 'StopFailure', error });

    expect(draft.data).toMatchObject({ outcome: 'error', error: { class: errorClass } });
  });

  it('keeps the failure details as content only', () => {
    let draft = draftOf(claudeHookPayloads['StopFailure']!);

    expect(draft.content?.map(entry => entry.role)).toEqual(['error_message', 'response']);
    expect(JSON.stringify(draft.data)).not.toContain(sentinel);
  });

  it('maps a stop failure without an error field', () => {
    expect(draftOf({ hook_event_name: 'StopFailure' }).data).toMatchObject({
      error: { class: 'unknown' }
    });
  });

  it('maps Interrupt as a cancelled turn', () => {
    expect(draftOf(claudeHookPayloads['Interrupt']!)).toMatchObject({
      type: 'turn.completed',
      data: { outcome: 'cancelled' }
    });
  });
});

describe('agent, compaction and settings events', () => {
  it('maps subagent start and stop', () => {
    let start = draftOf(claudeHookPayloads['SubagentStart']!);
    let stop = draftOf(claudeHookPayloads['SubagentStop']!);

    expect(start).toMatchObject({
      type: 'agent.start',
      factKey: 'agent:{session_key}:agent-1',
      ctx: { agent: { id: 'agent-1' } },
      data: { name: 'Explore', type: 'Explore' },
      content: []
    });
    expect(stop).toMatchObject({
      type: 'agent.end',
      data: { name: 'Explore', status: 'completed' }
    });
    expect(stop.content?.map(entry => entry.role)).toEqual(['response']);
  });

  it('has no fact key without an agent id', () => {
    expect(draftOf({ hook_event_name: 'SubagentStart' }).factKey).toBeNull();
  });

  it('maps compaction before and after', () => {
    expect(draftOf(claudeHookPayloads['PreCompact']!)).toMatchObject({
      type: 'context.compaction',
      role: 'supplemental',
      data: { trigger: 'auto', outcome: 'started' }
    });
    expect(draftOf(claudeHookPayloads['PostCompact']!)).toMatchObject({
      role: 'primary',
      data: { trigger: 'manual', outcome: 'ok' }
    });
  });

  it('maps model switches and config changes', () => {
    expect(draftOf(claudeHookPayloads['PostModelSwitch']!)).toMatchObject({
      type: 'settings.changed',
      data: {
        setting: 'model',
        from: 'claude-sonnet-4-5',
        to: 'claude-opus-4-1',
        trigger: 'user'
      }
    });
    expect(draftOf(claudeHookPayloads['ConfigChange']!)).toMatchObject({
      type: 'settings.changed',
      data: { setting: 'config', trigger: 'user_settings' }
    });
  });
});

describe('unmapped events', () => {
  it.each([
    ['Notification', 'ui'],
    ['Setup', 'startup'],
    ['InstructionsLoaded', 'memory'],
    ['FileChanged', 'diagnostic'],
    ['PreModelRequest', 'diagnostic']
  ])('categorizes %s as %s', (event, category) => {
    expect(draftOf({ hook_event_name: event }).data).toEqual({
      native_name: event,
      category
    });
  });

  it('keeps unknown events as uncategorized unmapped records', () => {
    expect(draftOf(claudeHookPayloads['SomethingNew']!)).toMatchObject({
      type: 'unmapped',
      signalName: 'SomethingNew',
      data: { native_name: 'SomethingNew' }
    });
  });

  it('is not fooled by event names matching object properties', () => {
    for (let event of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      let draft = draftOf({ hook_event_name: event });

      expect(draft.type).toBe('unmapped');
      expect(draft.data).toEqual({ native_name: event });
    }
  });

  it('is not fooled by property names as start sources or failure errors', () => {
    let start = draftOf({ hook_event_name: 'SessionStart', source: 'constructor' });
    let failure = draftOf({ hook_event_name: 'StopFailure', error: 'constructor' });

    expect(start.data).toEqual({ native: { source: 'constructor' } });
    expect(failure.data).toMatchObject({ error: { class: 'unknown' } });
  });

  it('falls back to unknown when no event name is present', () => {
    expect(draftOf({ session_id: 's' })).toMatchObject({
      type: 'unmapped',
      signalName: 'unknown'
    });
    expect(draftOf({}).data).toEqual({ native_name: 'unknown' });
  });

  it('accepts event name aliases', () => {
    expect(draftOf({ hookEventName: 'Stop' }).type).toBe('turn.completed');
    expect(draftOf({ event_name: 'Stop' }).type).toBe('turn.completed');
    expect(draftOf({ event: 'Stop' }).type).toBe('turn.completed');
  });

  it('clips very long event names', () => {
    let draft = draftOf({ hook_event_name: 'E'.repeat(500) });

    expect(draft.signalName).toHaveLength(64);
  });

  it('is case sensitive for event names', () => {
    expect(draftOf({ hook_event_name: 'stop' }).type).toBe('unmapped');
  });
});

describe('identity', () => {
  it('includes session, event, tool call and the caller hint', () => {
    let draft = draftOf(claudeHookPayloads['PreToolUse']!);

    expect(draft.identity).toBe('sess-123|PreToolUse|toolu_01|hint-1|');
  });

  it('differs per hint so retries of different deliveries stay distinct', () => {
    let a = claudeCodeHooks.map({ identityHint: 'a' }, claudeHookPayloads['Stop']!);
    let b = claudeCodeHooks.map({ identityHint: 'b' }, claudeHookPayloads['Stop']!);

    expect(a[0]?.draft.identity).not.toBe(b[0]?.draft.identity);
  });

  it('is stable for identical input', () => {
    expect(claudeCodeHooks.map(context, claudeHookPayloads['Stop']!)).toEqual(
      claudeCodeHooks.map(context, claudeHookPayloads['Stop']!)
    );
  });

  it('defaults occurredAt to null', () => {
    expect(
      claudeCodeHooks.map({ identityHint: 'h' }, { hook_event_name: 'Stop' })[0]?.draft
        .occurredAt
    ).toBeNull();
  });
});

describe('odd inputs', () => {
  it('never throws on wrong-typed fields', () => {
    let weird: unknown[] = [
      null,
      0,
      -1,
      1e999,
      NaN,
      '',
      ' ',
      [],
      {},
      [1, 2],
      true,
      'x'.repeat(10_000)
    ];

    for (let event of Object.keys(claudeHookPayloads)) {
      for (let value of weird) {
        let payload: Record<string, unknown> = {
          hook_event_name: event,
          session_id: value,
          tool_name: value,
          tool_use_id: value,
          tool_input: value,
          tool_response: value,
          prompt: value,
          error: value,
          duration_ms: value,
          is_interrupt: value,
          last_assistant_message: value,
          agent_id: value,
          source: value,
          mcp_server: value,
          model: value
        };

        expect(() => claudeCodeHooks.map(context, payload)).not.toThrow();
        expect(() => codexHooks.map(context, payload)).not.toThrow();
      }
    }
  });

  it('handles huge values without trouble', () => {
    let big = 'x'.repeat(2_000_000);
    let mapped = claudeCodeHooks.map(context, {
      hook_event_name: 'UserPromptSubmit',
      session_id: 's',
      prompt: big
    });

    expect(mapped[0]?.draft.data).toMatchObject({ length_chars: 2_000_000 });
  });

  it('survives prototype-polluting payload keys', () => {
    let payload = JSON.parse(
      '{"__proto__":{"polluted":1},"hook_event_name":"Stop","constructor":"x"}'
    );

    expect(claudeCodeHooks.map(context, payload)[0]?.draft.type).toBe('turn.completed');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('builds a record for every handled event', () => {
    for (let [event, payload] of Object.entries(claudeHookPayloads)) {
      for (let mapped of claudeCodeHooks.map(context, payload)) {
        let record = buildMapped(mapped);

        expect(record.source.channel).toBe('hook');
        expect(record.client.family).toBe('claude-code');
        expect(record.id, event).toMatch(/^[0-9a-f]{32}$/);
      }
    }
  });
});
