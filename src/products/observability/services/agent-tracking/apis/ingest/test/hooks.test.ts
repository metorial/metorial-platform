import { afterEach, describe, expect, it } from 'vitest';
import { createPipeline as createTestPipeline, errorBody } from './pipeline';
import { setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import { setRecordSink } from '@mtsrc/agent-tracking-module-records';

let sentinel = 'SENTINEL-d41d8cd9';

let createPipeline = (overrides: Parameters<typeof createTestPipeline>[0] = {}) =>
  createTestPipeline({
    ...overrides,
    binding: { deviceId: undefined, deviceMode: 'ephemeral', ...overrides.binding }
  });

let hookPath = (client: string) => `/v1/ingest/hooks/${client}`;

let promptHook = (overrides: Record<string, unknown> = {}) => ({
  session_id: 'session-1',
  transcript_path: '/Users/someone/.claude/transcript.jsonl',
  cwd: '/Users/someone/code/secret-project',
  hook_event_name: 'UserPromptSubmit',
  prompt: `please fix ${sentinel}`,
  ...overrides
});

let toolHook = (overrides: Record<string, unknown> = {}) => ({
  session_id: 'session-1',
  cwd: '/Users/someone/code/secret-project',
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_use_id: 'toolu_1',
  tool_input: { command: `cat ${sentinel}` },
  tool_response: { stdout: sentinel },
  ...overrides
});

afterEach(() => {
  setRuntime(undefined);
  setRecordSink(undefined);
});

describe('hook handler', () => {
  describe('mapping', () => {
    it('stores a prompt hook without any content in basic mode', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook())
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({});

      let [record] = pipeline.records();

      expect(pipeline.records()).toHaveLength(1);
      expect(record!.type).toBe('prompt.submitted');
      expect(record!.source).toMatchObject({
        adapter: 'claude-code',
        dialect: 'claude-code.hooks.v1',
        channel: 'hook',
        signal_name: 'UserPromptSubmit'
      });
      expect(record!.client.family).toBe('claude-code');
      expect(record!.ctx.session_id).toBe('session-1');
      expect(record!.ctx.session_key).toMatch(/^[0-9a-f]{32}$/);
      expect(record!.content.every(entry => entry.text === undefined)).toBe(true);
      expect(JSON.stringify(record)).not.toContain(sentinel);
    });

    it('never stores hook environment fields outside content entries', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      let serialized = JSON.stringify(pipeline.records()[0]);

      expect(serialized).not.toContain('secret-project');
      expect(serialized).not.toContain('transcript.jsonl');
    });

    it('keeps content only inside content entries in full mode', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      let [record] = pipeline.records();
      let outside = JSON.stringify({ ...record, content: [] });

      expect(record!.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
      expect(outside).not.toContain(sentinel);
    });

    it('maps a tool hook with a fact key and no raw tool data outside content', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(toolHook()) });

      let [record] = pipeline.records();

      expect(record!.type).toBe('tool.call');
      expect(record!.source.fact_key).toBe(`tool:${record!.ctx.session_key}:toolu_1`);
      expect(record!.ctx.tool_call_id).toBe('toolu_1');
      expect(JSON.stringify(record)).not.toContain(sentinel);
    });

    it('uses the codex dialect for codex', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('codex'), { body: JSON.stringify(promptHook()) });

      expect(pipeline.records()[0]!.source.dialect).toBe('codex.hooks.v1');
    });

    it('normalizes the client in the route', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('Claude_Code'), { body: JSON.stringify(promptHook()) });

      expect(pipeline.records()[0]!.client.family).toBe('claude-code');
    });

    it('falls back to the generic dialect for other clients', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('my-agent'), {
        body: JSON.stringify({ hook_event_name: 'Whatever', session_id: 's' })
      });

      let [record] = pipeline.seen();

      expect(response.status).toBe(200);
      expect(record!.type).toBe('unmapped');
      expect(record!.client.family).toBe('my-agent');
      expect(record!.source.dialect).toBe('generic.hooks.v1');
      expect(pipeline.records()).toEqual([]);
    });

    it('maps unknown events to unmapped records that are not stored', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify({ hook_event_name: 'BrandNewEvent', session_id: 's' })
      });

      expect(pipeline.seen()[0]!.type).toBe('unmapped');
      expect(pipeline.records()).toEqual([]);
    });

    it('accepts payloads without a session or event name', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), { body: '{"a":1}' });

      expect(response.status).toBe(200);
      expect(pipeline.seen()).toHaveLength(1);
    });

    it('writes several records for a stop hook with a message', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify({
          session_id: 's',
          hook_event_name: 'Stop',
          last_assistant_message: sentinel
        })
      });

      let types = pipeline.records().map(record => record.type);

      expect(types).toEqual(['turn.completed', 'message.assistant']);
      expect(JSON.stringify(pipeline.records())).not.toContain(sentinel);
    });
  });

  describe('record metadata', () => {
    it('stamps the ingest block from the principal', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      let [record] = pipeline.records();

      expect(record!.ingest).toMatchObject({
        organization_id: 'ator_test',
        project_id: 'atpr_test',
        instance_id: 'atin_test',
        credential_kind: 'token',
        credential_id: 'atit_test',
        route: 'hook',
        backfill: false
      });
      expect(record!.ingest.request_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('writes to the live lane', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      expect(pipeline.sink.list()[0]).toMatchObject({
        lane: 'live',
        organizationId: 'ator_test',
        projectId: 'atpr_test',
        instanceId: 'atin_test'
      });
    });

    it('treats arrival as event time without a warning', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      let [record] = pipeline.records();

      expect(record!.quality.time_source).toBe('observed');
      expect(record!.quality.warnings).not.toContain('time_unknown');
      expect(record!.occurred_at).toBe(record!.observed_at);
    });
  });

  describe('identity and idempotency', () => {
    it('derives the same id for a retried body', async () => {
      let pipeline = createPipeline();
      let body = JSON.stringify(promptHook());

      await pipeline.send(hookPath('claude-code'), { body });
      await pipeline.send(hookPath('claude-code'), { body });

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });

    it('derives different ids for different bodies', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook({ prompt: 'another prompt' }))
      });

      let [first, second] = pipeline.records();

      expect(first!.id).not.toBe(second!.id);
    });

    it('lets the event id header make identical bodies distinct', async () => {
      let pipeline = createPipeline();
      let body = JSON.stringify(promptHook());

      await pipeline.send(hookPath('claude-code'), {
        body,
        headers: { 'x-metorial-event-id': 'evt-1' }
      });
      await pipeline.send(hookPath('claude-code'), {
        body,
        headers: { 'x-metorial-event-id': 'evt-2' }
      });

      let [first, second] = pipeline.records();

      expect(first!.id).not.toBe(second!.id);
    });

    it('lets the event id header make different bodies identical', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        headers: { 'x-metorial-event-id': 'evt-1' }
      });
      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook({ prompt: 'changed' })),
        headers: { 'x-metorial-event-id': 'evt-1' }
      });

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });

    it('keeps ids apart between organizations', async () => {
      let first = createPipeline({ organization: { id: 'ator_a' } });
      await first.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ organization: { id: 'ator_b' } });
      await second.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      expect(second.records()[0]!.id).not.toBe(firstId);
    });

    it('keeps ids and session keys apart between instances', async () => {
      let first = createPipeline({ instance: { id: 'atin_a' } });
      await first.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let firstRecord = first.records()[0]!;

      let second = createPipeline({ instance: { id: 'atin_b' } });
      await second.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let secondRecord = second.records()[0]!;

      expect(secondRecord.id).not.toBe(firstRecord.id);
      expect(secondRecord.ctx.session_key).not.toBe(firstRecord.ctx.session_key);
      expect(secondRecord.ingest.instance_id).toBe('atin_b');
    });

    it('keeps ids apart between hash key versions', async () => {
      let first = createPipeline({ organization: { hashKeyVersion: 1 } });
      await first.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ organization: { hashKeyVersion: 2 } });
      await second.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      expect(second.records()[0]!.id).not.toBe(firstId);
    });
  });

  describe('observed-at header', () => {
    it('uses the header as agent observed time', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        headers: { 'x-metorial-observed-at': '2026-06-15T11:59:30Z' }
      });

      let [record] = pipeline.records();

      expect(record!.quality.time_source).toBe('agent_observed');
      expect(record!.occurred_at).toBe('2026-06-15T11:59:30.000Z');
      expect(record!.quality.warnings).not.toContain('clock_skew');
    });

    it('flags a time far from arrival as clock skew', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        headers: { 'x-metorial-observed-at': '2026-06-15T09:00:00Z' }
      });

      expect(pipeline.records()[0]!.quality.warnings).toContain('clock_skew');
    });

    it('rejects a malformed header', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        headers: { 'x-metorial-observed-at': 'yesterday' }
      });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_payload');
      expect(pipeline.records()).toHaveLength(0);
    });

    it.each(['a b', 'a/b', 'x'.repeat(129), 'é', 'a;b'])(
      'rejects the event id header %j',
      async eventId => {
        let pipeline = createPipeline();

        let response = await pipeline.send(hookPath('claude-code'), {
          body: JSON.stringify(promptHook()),
          headers: { 'x-metorial-event-id': eventId }
        });

        expect(response.status).toBe(400);
        expect((await errorBody(response)).code).toBe('invalid_payload');
        expect(pipeline.records()).toHaveLength(0);
      }
    );

    it('accepts an event id at the length limit', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        headers: { 'x-metorial-event-id': 'x'.repeat(128) }
      });

      expect(response.status).toBe(200);
    });

    it('treats a blank event id as absent', async () => {
      let pipeline = createPipeline();
      let body = JSON.stringify(promptHook());

      await pipeline.send(hookPath('claude-code'), { body });
      await pipeline.send(hookPath('claude-code'), {
        body,
        headers: { 'x-metorial-event-id': '   ' }
      });

      let [first, second] = pipeline.records();

      expect(first!.id).toBe(second!.id);
    });
  });

  describe('organization reporting settings', () => {
    let reporting = (settings: { toolDetails: boolean; sessionContext: boolean }) => ({
      contentPolicy: { defaultMode: 'full' as const },
      organization: {
        settings: { desktop: { ...settings, sessionTitles: false, historyImport: false } }
      }
    });

    let mcpHook = toolHook({
      tool_name: 'mcp__github__create_pr',
      mcp_server: { name: 'github' },
      tool_input: { title: sentinel },
      tool_response: { url: sentinel }
    });

    let skillHook = toolHook({
      tool_name: 'Skill',
      tool_use_id: 'toolu_2',
      tool_input: { skill: 'release-notes' },
      tool_response: { loaded: 'release-notes' }
    });

    let failedHook = toolHook({
      hook_event_name: 'PostToolUseFailure',
      tool_use_id: 'toolu_3',
      error: `exit 1: ${sentinel}`
    });

    let commandHook = promptHook({
      hook_event_name: 'UserPromptExpansion',
      command_name: 'deploy-staging',
      command_source: 'project'
    });

    let contextHook = {
      session_id: 'session-1',
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: '/Users/someone/code/secret-project',
      metorial: {
        git: {
          toplevel: '/Users/someone/code/secret-project',
          remote_url: 'https://github.com/example-org/probe-repo',
          branch: 'feature/MT-7-notes',
          head: '06de4d4304e317c123c4bbb07394249ed0cde401'
        }
      }
    };

    let send = async (pipeline: ReturnType<typeof createPipeline>, client = 'claude-code') => {
      for (let hook of [mcpHook, skillHook, failedHook, commandHook]) {
        await pipeline.send(hookPath(client), { body: JSON.stringify(hook) });
      }
    };

    let toolsOf = (pipeline: ReturnType<typeof createPipeline>) =>
      pipeline.records().filter(record => record.type == 'tool.call');

    it.each(['claude-code', 'codex'])(
      'stores no MCP or skill names and no tool inputs from %s while detailed tool reporting is off',
      async client => {
        let pipeline = createPipeline(reporting({ toolDetails: false, sessionContext: true }));

        await send(pipeline, client);

        let stored = JSON.stringify(pipeline.records());
        let command = pipeline.records().find(record => record.type == 'command.invoked');

        expect(stored).not.toContain(sentinel);
        expect(stored).not.toMatch(/github|create_pr|release-notes|deploy-staging/);
        expect(toolsOf(pipeline).map(record => record.data.tool)).toEqual([
          { name: 'mcp_tool', kind: 'mcp', class: 'mcp' },
          { name: 'Skill', kind: 'unknown', class: 'other' },
          { name: 'Bash', kind: 'shell', class: 'shell' }
        ]);
        for (let record of toolsOf(pipeline)) expect(record.content).toEqual([]);
        expect(command!.data).toMatchObject({ name: 'custom', source: 'project' });
      }
    );

    it('strips tool details by the default settings', async () => {
      let pipeline = createPipeline({ contentPolicy: { defaultMode: 'full' } });

      await send(pipeline);

      expect(JSON.stringify(pipeline.records())).not.toMatch(/SENTINEL|github|release-notes/);
    });

    it('keeps tool details while detailed tool reporting is on', async () => {
      let pipeline = createPipeline(reporting({ toolDetails: true, sessionContext: true }));

      await send(pipeline);

      let [mcp] = toolsOf(pipeline);
      let command = pipeline.records().find(record => record.type == 'command.invoked');

      expect(mcp!.data.tool).toEqual({
        name: 'mcp__github__create_pr',
        kind: 'mcp',
        class: 'mcp',
        mcp: { server: 'github', tool: 'create_pr' }
      });
      expect(
        toolsOf(pipeline).map(record =>
          record.content.some(entry => entry.text?.includes(sentinel))
        )
      ).toEqual([true, false, true]);
      expect(JSON.stringify(toolsOf(pipeline)[1]!.content)).toContain('release-notes');
      expect(command!.data).toMatchObject({ name: 'deploy-staging' });
    });

    it('stores no session context while session context is off', async () => {
      let pipeline = createPipeline(reporting({ toolDetails: true, sessionContext: false }));

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(contextHook) });
      await pipeline.send(hookPath('my-agent'), { body: JSON.stringify(contextHook) });

      let stored = JSON.stringify(pipeline.seen());

      expect(pipeline.seen().map(record => record.type)).toEqual([
        'session.start',
        'unmapped'
      ]);
      expect(stored).not.toMatch(/secret-project|probe-repo|MT-7|06de4d43/);
    });

    it('keeps session context while session context is on', async () => {
      let pipeline = createPipeline(reporting({ toolDetails: false, sessionContext: true }));

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(contextHook) });

      let context = pipeline.records().find(record => record.type == 'session.context');

      expect(context!.data).toMatchObject({
        branch: 'feature/MT-7-notes',
        head: '06de4d4304e317c123c4bbb07394249ed0cde401'
      });
    });

    let off = reporting({ toolDetails: false, sessionContext: true });
    let on = reporting({ toolDetails: true, sessionContext: true });

    let toolOfHook = async (
      settings: ReturnType<typeof reporting>,
      hook: Record<string, unknown>,
      client = 'claude-code'
    ) => {
      let pipeline = createPipeline(settings);

      await pipeline.send(hookPath(client), { body: JSON.stringify(hook) });

      return { pipeline, tool: toolsOf(pipeline)[0]?.data.tool };
    };

    let placeholder = { name: 'mcp_tool', kind: 'mcp', class: 'mcp' };

    it.each([
      ['a string server', { tool_name: 'create_issue', mcp_server: 'linear' }],
      ['a server object', { tool_name: 'create_issue', mcp_server: { name: 'linear' } }],
      ['an MCP-shaped name', { tool_name: 'linear__create_issue' }]
    ])(
      'redacts an MCP call named by %s while detailed tool reporting is off',
      async (_, extra) => {
        for (let client of ['claude-code', 'codex']) {
          let { pipeline, tool } = await toolOfHook(off, toolHook(extra), client);

          expect(tool).toEqual(placeholder);
          expect(JSON.stringify(pipeline.records())).not.toMatch(/linear|create_issue/);
        }
      }
    );

    it('keeps the server and tool of an MCP call while detailed tool reporting is on', async () => {
      let expected = {
        name: 'create_issue',
        kind: 'mcp',
        class: 'mcp',
        mcp: { server: 'linear', tool: 'create_issue' }
      };

      for (let server of ['linear', { name: 'linear' }]) {
        let { tool } = await toolOfHook(
          on,
          toolHook({ tool_name: 'create_issue', mcp_server: server })
        );

        expect(tool).toEqual(expected);
      }
    });

    it('treats a tool named like the placeholder as an ordinary tool while detailed tool reporting is on', async () => {
      let { tool } = await toolOfHook(on, toolHook({ tool_name: 'mcp_tool' }));

      expect(tool).toEqual({ name: 'mcp_tool', kind: 'unknown', class: 'other' });
    });

    it('keeps the tool call id, duration and outcome of a redacted call', async () => {
      let { pipeline } = await toolOfHook(
        off,
        toolHook({ tool_name: 'mcp__github__create_pr', duration_ms: 250 })
      );
      let [call] = toolsOf(pipeline);

      expect(call!.ctx.tool_call_id).toBe('toolu_1');
      expect(call!.source.fact_key).toBe(`tool:${call!.ctx.session_key}:toolu_1`);
      expect(call!.data).toMatchObject({ tool: placeholder, outcome: 'ok', duration_ms: 250 });
    });

    let subagentHook = (agentType: string) => ({
      session_id: 'session-1',
      hook_event_name: 'SubagentStart',
      agent_id: `agent-${agentType}`,
      agent_type: agentType
    });

    let agentNames = async (settings: ReturnType<typeof reporting>) => {
      let pipeline = createPipeline(settings);

      for (let agentType of ['my-reviewer', 'Explore', 'general-purpose']) {
        await pipeline.send(hookPath('claude-code'), {
          body: JSON.stringify(subagentHook(agentType))
        });
      }

      return pipeline.seen().map(record => record.data.name);
    };

    it('stores custom subagent names as the placeholder while detailed tool reporting is off', async () => {
      expect(await agentNames(off)).toEqual(['custom', 'Explore', 'general-purpose']);
    });

    it('keeps custom subagent names while detailed tool reporting is on', async () => {
      expect(await agentNames(on)).toEqual(['my-reviewer', 'Explore', 'general-purpose']);
    });

    let deniedHook = toolHook({
      hook_event_name: 'PermissionDenied',
      tool_use_id: 'toolu_9',
      reason: `blocked rm -rf ${sentinel}`
    });

    it('stores no denial reason of a tool while detailed tool reporting is off', async () => {
      let pipeline = createPipeline(off);

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(deniedHook) });

      let [decision] = pipeline.seen();

      expect(decision!.type).toBe('tool.decision');
      expect(decision!.content).toEqual([]);
      expect(JSON.stringify(pipeline.seen())).not.toContain(sentinel);
    });

    it('keeps the denial reason while detailed tool reporting is on', async () => {
      let pipeline = createPipeline(on);

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(deniedHook) });

      let [decision] = pipeline.seen();

      expect(
        decision!.content.some(
          entry => entry.role == 'error_message' && entry.text?.includes(sentinel)
        )
      ).toBe(true);
    });
  });

  describe('device-bound tokens', () => {
    it.each(['claude-code', 'codex', 'cursor', 'my-agent'])(
      'refuses hooks for %s from a token bound to a device',
      async client => {
        let pipeline = createTestPipeline();

        let response = await pipeline.send(hookPath(client), {
          body: JSON.stringify(toolHook())
        });

        expect(response.status).toBe(403);
        expect((await errorBody(response)).code).toBe('channel_not_allowed');
        expect(pipeline.records()).toHaveLength(0);
      }
    );
  });

  describe('request validation', () => {
    it('rejects an empty body', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), { body: '' });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_payload');
    });

    it.each(['[]', '"text"', '123', 'null', 'true', '{', '{"a":', 'not json'])(
      'rejects the non-object body %j',
      async body => {
        let pipeline = createPipeline();

        let response = await pipeline.send(hookPath('claude-code'), { body });

        expect(response.status).toBe(400);
        expect((await errorBody(response)).code).toBe('invalid_payload');
        expect(pipeline.records()).toHaveLength(0);
      }
    );

    it('rejects invalid utf-8', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0xfe, 0x22, 0x7d])
      });

      expect(response.status).toBe(400);
    });

    it('rejects an invalid client in the route', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('bad%20client!'), { body: '{}' });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('invalid_client');
    });

    it('rejects non-json content types', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        contentType: 'text/plain',
        body: '{}'
      });

      expect(response.status).toBe(415);
    });

    it('rejects oversized bodies', async () => {
      let pipeline = createPipeline();
      let body = JSON.stringify({ prompt: 'a'.repeat(5 * 1024 * 1024) });

      let response = await pipeline.send(hookPath('claude-code'), { body });

      expect(response.status).toBe(413);
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts gzip bodies', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook()),
        gzip: true
      });

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });

    it('rejects a gzip bomb', async () => {
      let pipeline = createPipeline();
      let body = JSON.stringify({ filler: 'a'.repeat(6 * 1024 * 1024) });

      let response = await pipeline.send(hookPath('claude-code'), { body, gzip: true });

      expect(response.status).toBe(413);
    });

    it('rejects a corrupt gzip body', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: new Uint8Array([1, 2, 3, 4, 5, 6]),
        headers: { 'content-encoding': 'gzip' }
      });

      expect(response.status).toBe(400);
      expect((await errorBody(response)).code).toBe('unreadable_body');
    });

    it('survives very deep nesting', async () => {
      let pipeline = createPipeline();
      let depth = 5000;
      let body = `{"hook_event_name":"PostToolUse","tool_input":${'['.repeat(depth)}${']'.repeat(depth)}}`;

      let response = await pipeline.send(hookPath('claude-code'), { body });

      expect([200, 400]).toContain(response.status);
    });

    it('survives hostile key names', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), {
        body: '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"hook_event_name":"Stop"}'
      });

      expect(response.status).toBe(200);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe('authorization', () => {
    it('rejects clients the token may not use', async () => {
      let pipeline = createPipeline({ allowedClients: ['codex'] });

      let response = await pipeline.send(hookPath('claude-code'), { body: '{}' });

      expect(response.status).toBe(403);
      expect((await errorBody(response)).code).toBe('client_not_allowed');
      expect(pipeline.records()).toHaveLength(0);
    });

    it('accepts an allowed client regardless of spelling', async () => {
      let pipeline = createPipeline({ allowedClients: ['claude_code'] });

      let response = await pipeline.send(hookPath('Claude-Code'), { body: '{}' });

      expect(response.status).toBe(200);
    });

    it('rejects tokens without the hook channel', async () => {
      let pipeline = createPipeline({ allowedChannels: ['otlp.logs'] });

      let response = await pipeline.send(hookPath('claude-code'), { body: '{}' });

      expect(response.status).toBe(403);
      expect((await errorBody(response)).code).toBe('channel_not_allowed');
    });
  });

  describe('sink failures', () => {
    it('answers 503 with Retry-After when the sink is busy', async () => {
      let pipeline = createPipeline();
      pipeline.sink.setBusy(true);

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook())
      });

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      expect((await errorBody(response)).code).toBe('sink_busy');
    });

    it('answers 500 without leaking the failure', async () => {
      let pipeline = createPipeline();
      pipeline.sink.failNext(new Error(`disk exploded ${sentinel}`));

      let response = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook())
      });

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(sentinel);
    });

    it('recovers after a failure', async () => {
      let pipeline = createPipeline();
      pipeline.sink.failNext();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let retry = await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify(promptHook())
      });

      expect(retry.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
    });
  });
});
