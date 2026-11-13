import { gzipSync, zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  createToken,
  errorCode,
  groundstation,
  ingest,
  instanceRecords,
  setSinkBusy
} from './support';

let sentinel = 'SENTINEL-e2e-hook-5d2c';

let promptHook = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    session_id: 'session-1',
    cwd: '/Users/someone/secret-project',
    transcript_path: '/Users/someone/.claude/t.jsonl',
    hook_event_name: 'UserPromptSubmit',
    prompt: `fix this ${sentinel}`,
    ...overrides
  });

describe('hook ingest', () => {
  it('stores a normalized record for a hook', async () => {
    let { organization, project, instance, secret, token } = await createToken();

    let response = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: promptHook()
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});

    let items = await instanceRecords(instance);
    let record = items[0]!.record;

    expect(items).toHaveLength(1);
    expect(items[0]!.lane).toBe('live');
    expect(record.type).toBe('prompt.submitted');
    expect(record.client.family).toBe('claude-code');
    expect(record.ingest).toMatchObject({
      organization_id: organization.id,
      project_id: project.id,
      instance_id: instance.id,
      credential_kind: 'token',
      credential_id: token.id,
      route: 'hook'
    });
    expect(record.ingest).not.toHaveProperty('principal');
  });

  it('never stores prompt text or environment fields with the default policy', async () => {
    let { instance, secret } = await createToken();

    await ingest('/v1/ingest/hooks/claude-code', { credential: secret, body: promptHook() });

    let serialized = JSON.stringify(await instanceRecords(instance));

    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain('t.jsonl');
  });

  it('applies the content policy of the token', async () => {
    let { instance, secret } = await createToken({ contentPolicy: { defaultMode: 'full' } });

    await ingest('/v1/ingest/hooks/claude-code', { credential: secret, body: promptHook() });

    let [item] = await instanceRecords(instance);

    expect(item!.record.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
    expect(JSON.stringify({ ...item!.record, content: [] })).not.toContain(sentinel);
    expect(JSON.stringify(item)).not.toContain('secret-project');
  });

  it('picks up an updated content policy without waiting for the cache', async () => {
    let { organization, instance, token, secret } = await createToken();

    await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: promptHook(),
      headers: { 'x-metorial-event-id': 'before' }
    });

    await groundstation().ingestToken.update({
      organizationId: organization.id,
      ingestTokenId: token.id,
      contentPolicy: { defaultMode: 'full' }
    });

    await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: promptHook(),
      headers: { 'x-metorial-event-id': 'after' }
    });

    let [before, after] = await instanceRecords(instance);

    expect(before!.record.content.some(entry => entry.text !== undefined)).toBe(false);
    expect(after!.record.content.some(entry => entry.text?.includes(sentinel))).toBe(true);
  });

  it('is idempotent for a retried event', async () => {
    let { instance, secret } = await createToken();

    for (let i = 0; i < 2; i++) {
      await ingest('/v1/ingest/hooks/codex', {
        credential: secret,
        body: promptHook(),
        headers: { 'x-metorial-event-id': 'evt-1' }
      });
    }

    let items = await instanceRecords(instance);

    expect(items).toHaveLength(2);
    expect(items[0]!.record.id).toBe(items[1]!.record.id);
  });

  it('accepts gzip and zstd bodies', async () => {
    let { instance, secret } = await createToken();

    let gzip = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      headers: { 'content-encoding': 'gzip' },
      body: gzipSync(promptHook({ prompt: 'a' }))
    });

    let zstd = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      headers: { 'content-encoding': 'zstd' },
      body: zstdCompressSync(promptHook({ prompt: 'b' }))
    });

    expect(gzip.status).toBe(200);
    expect(zstd.status).toBe(200);
    expect(await instanceRecords(instance)).toHaveLength(2);
  });

  it('rejects invalid payloads and stores nothing', async () => {
    let { instance, secret } = await createToken();

    for (let body of ['', '[]', 'nope', '"text"']) {
      let response = await ingest('/v1/ingest/hooks/claude-code', {
        credential: secret,
        body
      });

      expect(response.status, body).toBe(400);
      expect(await errorCode(response), body).toBe('invalid_payload');
    }

    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('rejects invalid clients', async () => {
    let { secret } = await createToken();

    let response = await ingest('/v1/ingest/hooks/Bad%20Client!', { credential: secret });

    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('invalid_client');
  });

  it('handles unknown clients with the generic dialect', async () => {
    let { instance, secret } = await createToken();

    let response = await ingest('/v1/ingest/hooks/my-agent', {
      credential: secret,
      body: JSON.stringify({ hook_event_name: 'Custom', session_id: 's' })
    });

    expect(response.status).toBe(200);
    expect((await instanceRecords(instance))[0]!.record.source.dialect).toBe(
      'generic.hooks.v1'
    );
  });

  it('enforces the allowed clients of the token', async () => {
    let { instance, secret } = await createToken({ allowedClients: ['codex'] });

    let denied = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: promptHook()
    });

    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe('client_not_allowed');
    expect(await instanceRecords(instance)).toHaveLength(0);
  });

  it('answers 503 with Retry-After while the sink is busy and recovers', async () => {
    let { instance, secret } = await createToken();

    await setSinkBusy(true);

    try {
      let busy = await ingest('/v1/ingest/hooks/claude-code', {
        credential: secret,
        body: promptHook()
      });

      expect(busy.status).toBe(503);
      expect(busy.headers.get('retry-after')).toBe('5');
      expect(await errorCode(busy)).toBe('sink_busy');
      expect(await instanceRecords(instance)).toHaveLength(0);
    } finally {
      await setSinkBusy(false);
    }

    let retry = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: promptHook()
    });

    expect(retry.status).toBe(200);
    expect(await instanceRecords(instance)).toHaveLength(1);
  });

  it('keeps records of different instances apart', async () => {
    let first = await createToken();
    let second = await createToken();

    await ingest('/v1/ingest/hooks/claude-code', {
      credential: first.secret,
      body: promptHook()
    });
    await ingest('/v1/ingest/hooks/claude-code', {
      credential: first.secret,
      body: promptHook({ prompt: 'two' })
    });
    await ingest('/v1/ingest/hooks/claude-code', {
      credential: second.secret,
      body: promptHook()
    });

    let firstItems = await instanceRecords(first.instance);
    let secondItems = await instanceRecords(second.instance);

    expect(firstItems).toHaveLength(2);
    expect(secondItems).toHaveLength(1);
    expect(secondItems[0]!.record.ingest.instance_id).toBe(second.instance.id);
    expect(secondItems[0]!.record.id).not.toBe(firstItems[0]!.record.id);
  });
});
