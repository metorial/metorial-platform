import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import { createScope, createToken, agentTracking, ingest, rpcErrorCode } from './support';

let minuteMs = 60 * 1000;

type ListInput = Parameters<ReturnType<typeof agentTracking>['session']['list']>[0];

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

    let list = await agentTracking().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id]
    });

    expect(list.items).toHaveLength(1);
    expect(list.pagination).toEqual({ hasMoreAfter: false, hasMoreBefore: false });

    let listed = list.items[0]!;
    expect(listed).toMatchObject({
      object: 'agent_tracking#session',
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

    let session = await agentTracking().session.get({
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

    let ended = await agentTracking().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      states: ['ended']
    });

    expect(ended.items).toHaveLength(1);
    expect(ended.items[0]!.endedAt).not.toBeNull();

    let page = await agentTracking().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      limit: 1
    });

    expect(page.items).toHaveLength(1);
    expect(page.pagination.hasMoreAfter).toBe(true);

    let rest = await agentTracking().session.list({
      organizationId: organization.id,
      instanceIds: [instance.id],
      limit: 1,
      after: page.pagination.after
    });

    expect(rest.items).toHaveLength(1);
    expect(rest.items[0]!.sessionKey).not.toBe(page.items[0]!.sessionKey);
  });

  it('keeps sessions inside their organization', async () => {
    let { organization, instance, secret } = await createToken();
    let other = await createScope();

    await sendHooks(secret, uniqueId('session'), ['UserPromptSubmit']);

    let [session] = (
      await agentTracking().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      })
    ).items;

    expect(
      await rpcErrorCode(
        agentTracking().session.get({
          organizationId: other.organization.id,
          sessionKey: session!.sessionKey
        })
      )
    ).toBe('not_found');

    let foreign = await agentTracking().session.list({
      organizationId: other.organization.id
    });
    expect(foreign.items).toHaveLength(0);
  });

  it(
    'filters by canonical model and pages in both directions',
    { timeout: 180_000 },
    async () => {
      await importKnowledge();

      let { organization, instance, secret } = await createToken();
      let base = Date.now() - 30 * minuteMs;
      let sessionIds = [uniqueId('session'), uniqueId('session'), uniqueId('session')];

      for (let [index, sessionId] of sessionIds.entries()) {
        await sendClaudeApiRequest({
          secret,
          sessionId,
          model: 'claude-sonnet-4-5-20250929',
          inputTokens: 1000,
          outputTokens: 100,
          at: new Date(base + index * minuteMs)
        });
      }

      await sendClaudeApiRequest({
        secret,
        sessionId: uniqueId('session'),
        model: 'unlisted-model',
        inputTokens: 1000,
        outputTokens: 100,
        at: new Date(base + 3 * minuteMs)
      });

      let list = (input: Partial<ListInput> = {}) =>
        agentTracking().session.list({
          organizationId: organization.id,
          instanceIds: [instance.id],
          modelIds: ['claude-sonnet-4-5'],
          ...input
        });

      let all = await eventually(
        async () => {
          let page = await list();
          expect(page.items).toHaveLength(3);

          return page.items;
        },
        { timeoutMs: 60_000 }
      );

      let unfiltered = await list({ modelIds: undefined });
      expect(unfiltered.items).toHaveLength(4);

      let unlisted = await eventually(
        async () => {
          let page = await list({ modelIds: [null] });
          expect(page.items).toHaveLength(1);

          return page.items;
        },
        { timeoutMs: 60_000 }
      );
      expect(unlisted[0]!.summary!.models).toEqual([
        expect.objectContaining({ modelId: null, rawIds: ['unlisted-model'] })
      ]);
      expect((await list({ modelIds: ['claude-sonnet-4-5', null] })).items).toHaveLength(4);

      let activity = all.map(session => new Date(session.lastActivityAt).getTime());
      expect(activity).toEqual([...activity].sort((a, b) => b - a));

      let first = await list({ limit: 1 });
      expect(first.items.map(session => session.sessionKey)).toEqual([all[0]!.sessionKey]);
      expect(first.pagination).toMatchObject({
        hasMoreAfter: true,
        hasMoreBefore: false,
        after: expect.any(String)
      });

      let second = await list({ limit: 1, after: first.pagination.after });
      expect(second.items.map(session => session.sessionKey)).toEqual([all[1]!.sessionKey]);
      expect(second.pagination).toMatchObject({
        hasMoreAfter: true,
        hasMoreBefore: true,
        after: expect.any(String),
        before: expect.any(String)
      });

      let byKey = await list({ limit: 1, after: all[0]!.sessionKey });
      expect(byKey.items.map(session => session.sessionKey)).toEqual([all[1]!.sessionKey]);

      let back = await list({ limit: 1, before: second.pagination.before });
      expect(back.items.map(session => session.sessionKey)).toEqual([all[0]!.sessionKey]);
      expect(back.pagination).toMatchObject({ hasMoreAfter: true, hasMoreBefore: false });

      let last = await list({ limit: 2, after: all[0]!.sessionKey });
      expect(last.items.map(session => session.sessionKey)).toEqual([
        all[1]!.sessionKey,
        all[2]!.sessionKey
      ]);
      expect(last.pagination).toEqual({
        hasMoreAfter: false,
        hasMoreBefore: true,
        before: expect.any(String)
      });

      let ascending = await list({ order: 'asc' });
      expect(ascending.items.map(session => session.sessionKey)).toEqual(
        [...all].reverse().map(session => session.sessionKey)
      );

      expect(await rpcErrorCode(list({ after: uniqueId('session') }))).toBe('bad_request');
      expect(
        await rpcErrorCode(
          list({ instanceIds: [uniqueId('inst')], after: all[0]!.sessionKey })
        )
      ).toBe('bad_request');
      expect(
        await rpcErrorCode(list({ after: all[0]!.sessionKey, before: all[2]!.sessionKey }))
      ).toBe('bad_request');
    }
  );
});
