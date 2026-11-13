import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createScope, createToken, groundstation, ingest, rpcErrorCode } from './support';

let hook = (sessionId: string, event: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ session_id: sessionId, hook_event_name: event, ...extra });

let sendHooks = async (secret: string, sessionId: string, events: string[]) => {
  for (let event of events) {
    let response = await ingest('/v1/ingest/hooks/claude-code', {
      credential: secret,
      body: hook(sessionId, event, event == 'UserPromptSubmit' ? { prompt: 'hello' } : {})
    });

    expect(response.status).toBe(200);
  }
};

describe('sessions', () => {
  it('creates a native session from hooks and summarizes it on read', async () => {
    let { organization, project, instance, secret, token } = await createToken();
    let sessionId = uniqueId('session');

    await sendHooks(secret, sessionId, ['SessionStart', 'UserPromptSubmit', 'Stop']);

    let list = await groundstation().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id]
    });

    expect(list.items).toHaveLength(1);
    expect(list.pagination).toEqual({ hasMore: false, nextCursor: null });

    let listed = list.items[0]!;
    expect(listed).toMatchObject({
      object: 'groundstation#session',
      projectId: project.id,
      instanceId: instance.id,
      origin: 'native',
      state: 'active',
      client: { family: 'claude-code' },
      observed: { userId: token.userEntityId, deviceId: token.deviceEntityId }
    });
    expect(listed).not.toHaveProperty('_id');
    expect(listed).not.toHaveProperty('inferKey');
    expect(listed).not.toHaveProperty('expiresAt');

    let session = await groundstation().session.get({
      organizationId: organization.id,
      sessionKey: listed.sessionKey
    });

    expect(session.summaryStale).toBe(false);
    expect(session.summary).toMatchObject({ prompts: 1, turns: 1, requests: 0 });
    expect(session.summary!.costUsd).toBeNull();
  });

  it('ends a session on SessionEnd and filters the list by state', async () => {
    let { organization, instance, secret } = await createToken();

    await sendHooks(secret, uniqueId('session'), ['SessionStart', 'SessionEnd']);
    await sendHooks(secret, uniqueId('session'), ['SessionStart']);

    let ended = await groundstation().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      states: ['ended']
    });

    expect(ended.items).toHaveLength(1);
    expect(ended.items[0]!.endedAt).not.toBeNull();

    let page = await groundstation().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      limit: 1
    });

    expect(page.items).toHaveLength(1);
    expect(page.pagination.hasMore).toBe(true);

    let rest = await groundstation().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      limit: 1,
      cursor: page.pagination.nextCursor!
    });

    expect(rest.items).toHaveLength(1);
    expect(rest.items[0]!.sessionKey).not.toBe(page.items[0]!.sessionKey);
  });

  it('keeps sessions inside their organization', async () => {
    let { organization, instance, secret } = await createToken();
    let other = await createScope();

    await sendHooks(secret, uniqueId('session'), ['UserPromptSubmit']);

    let [session] = (
      await groundstation().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      })
    ).items;

    expect(
      await rpcErrorCode(
        groundstation().session.get({
          organizationId: other.organization.id,
          sessionKey: session!.sessionKey
        })
      )
    ).toBe('not_found');

    let foreign = await groundstation().session.list({
      organizationId: other.organization.id
    });
    expect(foreign.items).toHaveLength(0);
  });

  it('rejects an invalid cursor', async () => {
    let { organization } = await createScope();

    expect(
      await rpcErrorCode(
        groundstation().session.list({ organizationId: organization.id, cursor: 'nope' })
      )
    ).toBe('bad_request');
  });
});
