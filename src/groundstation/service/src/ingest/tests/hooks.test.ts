import { afterEach, describe, expect, it } from 'vitest';
import { createPipeline, errorBody } from '../../test/pipeline';
import { setRuntime } from '../../runtime';

let sentinel = 'SENTINEL-d41d8cd9';

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

afterEach(() => setRuntime(undefined));

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

      let [record] = pipeline.records();

      expect(response.status).toBe(200);
      expect(record!.type).toBe('unmapped');
      expect(record!.client.family).toBe('my-agent');
      expect(record!.source.dialect).toBe('generic.hooks.v1');
    });

    it('maps unknown events to unmapped records', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), {
        body: JSON.stringify({ hook_event_name: 'BrandNewEvent', session_id: 's' })
      });

      expect(pipeline.records()[0]!.type).toBe('unmapped');
    });

    it('accepts payloads without a session or event name', async () => {
      let pipeline = createPipeline();

      let response = await pipeline.send(hookPath('claude-code'), { body: '{"a":1}' });

      expect(response.status).toBe(200);
      expect(pipeline.records()).toHaveLength(1);
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
        tenant_id: 'gst_tenant_1',
        credential_id: 'itk_test',
        route: 'hook',
        backfill: false,
        principal: { ref: 'user_1' }
      });
      expect(record!.ingest.request_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('writes to the live lane', async () => {
      let pipeline = createPipeline();

      await pipeline.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      expect(pipeline.sink.list()[0]).toMatchObject({
        lane: 'live',
        tenantId: 'gst_tenant_1'
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

    it('keeps ids apart between tenants', async () => {
      let first = createPipeline({ tenant: { id: 'gst_a' } });
      await first.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ tenant: { id: 'gst_b' } });
      await second.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });

      expect(second.records()[0]!.id).not.toBe(firstId);
    });

    it('keeps ids apart between hash key versions', async () => {
      let first = createPipeline({ tenant: { hashKeyVersion: 1 } });
      await first.send(hookPath('claude-code'), { body: JSON.stringify(promptHook()) });
      let firstId = first.records()[0]!.id;

      let second = createPipeline({ tenant: { hashKeyVersion: 2 } });
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
