import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessionService } from '../src/services/session';
import { closeRedis, getCacheRedis } from '@mtsrc/agent-tracking-redis';
import { correlationCacheKey, inferCacheKey, summaryLockKey } from '../src/lib/cacheKeys';
import { settleSession } from '../src/lib/settle';
import { sessionlessBucket, settleSessionless } from '../src/lib/sessionless';
import { createSessionHarness, minutesAfter, store } from './harness';

let dayMs = 24 * 60 * 60 * 1000;

let model = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

beforeAll(async () => {
  await store.ready();
});

afterAll(async () => {
  await closeRedis();
});

describe('native sessions', () => {
  it('upserts one session per session key with its context and observed ids', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);

    let [first] = await harness.ingest([
      { type: 'session.start', at: start, sessionId: 'native-1' },
      {
        type: 'session.context',
        at: minutesAfter(start, 1),
        sessionId: 'native-1',
        data: {
          source: 'hook',
          branch: 'feat/sessions',
          head: 'abc123',
          tags: [{ k: 'team', v: 'core', origin: 'source' }],
          ticket_refs: ['ENG-42']
        }
      },
      {
        type: 'model.request',
        at: minutesAfter(start, 2),
        sessionId: 'native-1',
        data: { model, usage: { inputUncached: 100, output: 10 } }
      }
    ]);

    let sessionKey = first!.ctx.session_key!;
    expect(first!.ctx.session_origin).toBe('native');

    let session = (await harness.session(sessionKey))!;
    expect(session).toMatchObject({
      organizationId: harness.scope.organization.id,
      projectId: harness.scope.project.id,
      instanceId: harness.scope.instance.id,
      origin: 'native',
      state: 'active',
      rootSessionKey: sessionKey,
      client: { family: 'claude-code', version: '2.1.0' },
      observed: { userId: 'aten_user_unit', deviceId: 'aten_device_unit' },
      context: {
        branch: 'feat/sessions',
        head: 'abc123',
        tags: [{ k: 'team', v: 'core', origin: 'source' }],
        ticketRefs: ['ENG-42'],
        pathStored: false
      },
      versions: { summary: 0, attribution: 0, facts: 0 },
      settlePending: true
    });
    expect(session.startedAt).toEqual(start);
    expect(session.lastActivityAt).toEqual(minutesAfter(start, 2));
    expect(session.expiresAt).toEqual(new Date(start.getTime() + 400 * dayMs));

    await harness.ingest([
      { type: 'session.start', at: minutesAfter(start, -5), sessionId: 'native-1' },
      { type: 'session.end', at: minutesAfter(start, 10), sessionId: 'native-1' }
    ]);

    session = (await harness.session(sessionKey))!;
    expect(session.state).toBe('ended');
    expect(session.startedAt).toEqual(minutesAfter(start, -5));
    expect(session.endedAt).toEqual(minutesAfter(start, 10));
    expect(session.context.tags).toHaveLength(1);

    await harness.ingest([
      { type: 'session.start', at: minutesAfter(start, 20), sessionId: 'native-1' }
    ]);

    session = (await harness.session(sessionKey))!;
    expect(session.state).toBe('active');
    expect(session.endedAt).toBeUndefined();
  });

  it('rolls repo and workspace ids from session.context records into the session', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    let context = harness.draft(
      { type: 'session.context', at, sessionId: 'repo-1', data: { source: 'hook' } },
      at
    );
    context.attribution = { repo_id: 'aten_repo', workspace_id: 'aten_workspace' };

    let [record] = await harness.ingestRecords(
      [context, harness.draft({ type: 'turn.completed', at, sessionId: 'repo-1' }, at)],
      at
    );
    let sessionKey = record!.ctx.session_key!;

    expect((await harness.session(sessionKey))!.context).toMatchObject({
      repoIds: ['aten_repo'],
      workspaceIds: ['aten_workspace']
    });

    await settleSession({ sessionKey });

    expect((await harness.session(sessionKey))!.coverage).toMatchObject({
      hasContext: true,
      hasRepo: true
    });
  });

  it('roots child sessions at their parent', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    let [parent] = await harness.ingest([
      { type: 'session.start', at, sessionId: 'parent-1' }
    ]);
    let [child] = await harness.ingest([
      {
        type: 'session.start',
        at: minutesAfter(at, 1),
        sessionId: 'child-1',
        ctx: { parentSessionId: 'parent-1' }
      }
    ]);

    let session = (await harness.session(child!.ctx.session_key!))!;
    expect(session.parentSessionKey).toBe(parent!.ctx.session_key);
    expect(session.rootSessionKey).toBe(parent!.ctx.session_key);
  });
});

describe('linked records', () => {
  it('joins records through session_links when the Redis cache is gone', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    let [native] = await harness.ingest([
      { type: 'model.request', at, sessionId: 'linked-1', ctx: { requestId: 'req-link-1' } }
    ]);
    let sessionKey = native!.ctx.session_key!;
    let linkId = `${harness.scope.instance.id}:request:req-link-1`;

    let link = await harness.collections().sessionLinks.findOne({ _id: linkId });
    expect(link?.sessionKey).toBe(sessionKey);
    expect(link!.expiresAt.getTime()).toBeGreaterThan(at.getTime() + dayMs - 60_000);

    await getCacheRedis().del(correlationCacheKey(linkId));

    let [linked] = await harness.ingest([
      {
        type: 'usage.charge',
        at: minutesAfter(at, 2),
        channel: 'otlp.logs',
        ctx: { requestId: 'req-link-1' }
      }
    ]);

    expect(linked!.ctx.session_key).toBe(sessionKey);
    expect(linked!.ctx.session_origin).toBe('linked');

    let stored = await harness.collections().events.findOne({ _id: linked!.id });
    expect(stored?.ctx).toMatchObject({ sessionKey, sessionOrigin: 'linked' });
  });
});

describe('inferred sessions', () => {
  it('groups records per device and starts a new session after the inactivity gap', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 2 * 60 * 60 * 1000);

    let records = await harness.ingest([
      { type: 'prompt.submitted', at: start },
      { type: 'model.request', at: minutesAfter(start, 10) },
      { type: 'model.request', at: minutesAfter(start, 50) }
    ]);

    let [first, second, third] = records.map(record => record.ctx.session_key);
    expect(records.every(record => record.ctx.session_origin == 'inferred')).toBe(true);
    expect(second).toBe(first);
    expect(third).not.toBe(first);

    let inferKey = `${harness.scope.instance.id}:claude-code:aten_device_unit`;
    let sessions = await harness
      .collections()
      .sessions.find({ instanceId: harness.scope.instance.id })
      .toArray();
    expect(sessions.map(session => [session.origin, session.inferKey])).toEqual([
      ['inferred', inferKey],
      ['inferred', inferKey]
    ]);

    let [cached] = await harness.ingest([
      { type: 'model.request', at: minutesAfter(start, 70) }
    ]);
    expect(cached!.ctx.session_key).toBe(third);

    await getCacheRedis().del(inferCacheKey(inferKey));

    let [fromMongo] = await harness.ingest([
      { type: 'model.request', at: minutesAfter(start, 90) }
    ]);
    expect(fromMongo!.ctx.session_key).toBe(third);

    let [late] = await harness.ingest([
      { type: 'model.request', at: minutesAfter(start, 200) }
    ]);
    expect([first, third]).not.toContain(late!.ctx.session_key);
  });

  it('keeps a retried record in the session it was first given', async () => {
    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 4 * 60 * 60 * 1000);

    let [original] = await harness.ingest([
      { type: 'prompt.submitted', at, identity: 'retry-1' }
    ]);
    await harness.ingest([{ type: 'prompt.submitted', at: minutesAfter(at, 120) }]);

    let [retried] = await harness.ingest([
      { type: 'prompt.submitted', at, identity: 'retry-1' }
    ]);
    expect(retried!.id).toBe(original!.id);
    expect(retried!.ctx.session_key).toBe(original!.ctx.session_key);
  });

  it('honours the instance gap setting and leaves aggregates sessionless', async () => {
    let harness = await createSessionHarness({ settings: { inferredSessionGapMinutes: 5 } });
    let at = new Date(Date.now() - 60 * 60 * 1000);

    let records = await harness.ingest([
      { type: 'model.request', at },
      { type: 'model.request', at: minutesAfter(at, 10) },
      { type: 'model.request', at, role: 'aggregate' },
      { kind: 'measurement', type: 'tokens', at, data: { value: 1 } }
    ]);

    expect(records[1]!.ctx.session_key).not.toBe(records[0]!.ctx.session_key);
    expect(records[2]!.ctx.session_key).toBeUndefined();
    expect(records[3]!.ctx.session_key).toBeUndefined();
  });
});

describe('sessionless usage', () => {
  it('keeps a cost sent with an ingestion key an estimate', async () => {
    let harness = await createSessionHarness({
      credential: { kind: 'source', id: 'atis_shared_key' }
    });
    let start = new Date(Math.floor(Date.now() / dayMs) * dayMs - dayMs);
    let window = { start, end: new Date(start.getTime() + dayMs) };
    let dims = { model: model.id, provider: model.provider };

    await harness.ingest([
      {
        kind: 'measurement',
        type: 'requests',
        at: window.end,
        family: 'kiro',
        channel: 'otlp.metrics',
        role: 'aggregate',
        data: { value: 1, unit: '{request}', aggregation: 'delta', window, dims }
      },
      {
        kind: 'measurement',
        type: 'cost',
        at: window.end,
        family: 'kiro',
        channel: 'otlp.metrics',
        role: 'aggregate',
        data: { value: 0.5, unit: 'USD', aggregation: 'delta', window, dims }
      }
    ]);

    let { bucket } = sessionlessBucket({ occurredAt: window.end, window });
    await settleSessionless({
      organizationId: harness.scope.organization.id,
      instanceId: harness.scope.instance.id,
      bucket
    });

    let slices = await harness
      .collections()
      .usageSlices.find({ instanceId: harness.scope.instance.id })
      .toArray();
    expect(slices.flatMap(slice => slice.costReported.map(cost => cost.basis))).toEqual([
      'client_estimate'
    ]);
  });
});

describe('settling', () => {
  it('links orphans into the native session and drops the emptied inferred session', async () => {
    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 30 * 60 * 1000);

    let [orphan] = await harness.ingest([
      {
        type: 'model.request',
        at,
        channel: 'otlp.logs',
        ctx: { requestId: 'req-orphan-1' },
        data: { model, usage: { inputUncached: 500, output: 50 } }
      }
    ]);
    let inferredKey = orphan!.ctx.session_key!;
    expect(orphan!.ctx.session_origin).toBe('inferred');

    let orphanId = `orphan:${harness.scope.instance.id}:request:req-orphan-1`;
    let registered = await harness.collections().sessionLinks.findOne({ _id: orphanId });
    expect(registered?.recordIds).toEqual([orphan!.id]);

    let [native] = await harness.ingest([
      {
        type: 'turn.completed',
        at: minutesAfter(at, 1),
        sessionId: 'orphan-native',
        ctx: { requestId: 'req-orphan-1' }
      }
    ]);
    let nativeKey = native!.ctx.session_key!;

    await settleSession({ sessionKey: nativeKey });

    let moved = await harness.collections().events.findOne({ _id: orphan!.id });
    expect(moved?.ctx).toMatchObject({ sessionKey: nativeKey, sessionOrigin: 'linked' });
    expect(await harness.collections().sessionLinks.findOne({ _id: orphanId })).toBeNull();

    let session = (await harness.session(nativeKey))!;
    expect(session.startedAt).toEqual(at);
    expect(session.lastActivityAt).toEqual(minutesAfter(at, 1));
    expect(session.summary).toMatchObject({ turns: 1, requests: 1, durationMs: 60_000 });
    expect(session.summary!.tokens.inputUncached).toBe(500);
    expect(session.settledObservedAt).toEqual(session.lastObservedAt);
    expect(session.coverage).toMatchObject({ hasUsage: true, usageSource: 'otel.logs' });

    await settleSession({ sessionKey: inferredKey });
    expect(await harness.session(inferredKey)).toBeNull();

    await settleSession({ sessionKey: nativeKey });
    expect((await harness.session(nativeKey))!.summary).toMatchObject({
      turns: 1,
      requests: 1
    });
  });

  it('leaves a session in which nothing happened out of the list until a prompt arrives', async () => {
    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 10 * 60 * 1000);
    let organization = harness.scope.organization;

    let [quiet] = await harness.ingest([
      { type: 'session.start', at, sessionId: 'quiet-1' },
      {
        type: 'model.request',
        at: minutesAfter(at, 0.1),
        sessionId: 'quiet-1',
        channel: 'otlp.logs',
        role: 'supplemental',
        data: { usage: { inputUncached: 2 }, purpose: 'auxiliary', warmup: true }
      }
    ]);
    let quietKey = quiet!.ctx.session_key!;

    let [busy] = await harness.ingest([
      { type: 'prompt.submitted', at: minutesAfter(at, 1), sessionId: 'busy-1' }
    ]);
    let busyKey = busy!.ctx.session_key!;

    await settleSession({ sessionKey: quietKey });
    await settleSession({ sessionKey: busyKey });

    let listed = async () =>
      (await sessionService.listSessions({ organization, filters: {} })).items.map(
        session => session._id
      );

    expect((await harness.session(quietKey))!.empty).toBe(true);
    expect(await listed()).toEqual([busyKey]);

    await harness.ingest([
      { type: 'prompt.submitted', at: minutesAfter(at, 2), sessionId: 'quiet-1' }
    ]);
    await settleSession({ sessionKey: quietKey });

    expect((await harness.session(quietKey))!.empty).toBeUndefined();
    expect(await listed()).toEqual([quietKey, busyKey]);
  });

  it('clears the pending flag once facts cover the latest write', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    let [record] = await harness.ingest([
      { type: 'turn.completed', at, sessionId: 'pending-1' }
    ]);
    let sessionKey = record!.ctx.session_key!;

    await settleSession({ sessionKey });

    let session = (await harness.session(sessionKey))!;
    expect(session.factsComputedAt).toBeInstanceOf(Date);
    expect(session.settlePending).toBeUndefined();
    expect(session.versions.summary).toBeGreaterThan(0);
  });
});

describe('lazy summary', () => {
  it('reuses a summary at the watermark and recomputes it after new records', async () => {
    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 10 * 60 * 1000);

    let [record] = await harness.ingest(
      [{ type: 'turn.completed', at, sessionId: 'lazy-1' }],
      minutesAfter(at, 1)
    );
    let sessionKey = record!.ctx.session_key!;
    let organization = harness.scope.organization;

    let first = await sessionService.getSession({ organization, sessionKey });
    expect(first.summary?.turns).toBe(1);
    expect(first.summaryWatermark).toEqual(minutesAfter(at, 1));

    let stored = (await harness.session(sessionKey))!;
    expect(stored.summary?.turns).toBe(1);

    await harness
      .collections()
      .sessions.updateOne({ _id: sessionKey }, { $set: { 'summary.turns': 99 } });
    expect(
      (await sessionService.getSession({ organization, sessionKey })).summary?.turns
    ).toBe(99);

    await harness.ingest(
      [{ type: 'turn.completed', at: minutesAfter(at, 2), sessionId: 'lazy-1' }],
      minutesAfter(at, 3)
    );

    await getCacheRedis().set(summaryLockKey(sessionKey), '1', 'EX', 60);
    expect(
      (await sessionService.getSession({ organization, sessionKey })).summary?.turns
    ).toBe(99);
    await getCacheRedis().del(summaryLockKey(sessionKey));

    let refreshed = await sessionService.getSession({ organization, sessionKey });
    expect(refreshed.summary?.turns).toBe(2);
    expect(refreshed.summaryWatermark).toEqual(minutesAfter(at, 3));
  });

  it('is scoped to the organization', async () => {
    let harness = await createSessionHarness();
    let other = await createSessionHarness();

    let [record] = await harness.ingest([
      { type: 'turn.completed', at: new Date(), sessionId: 'scoped-1' }
    ]);

    await expect(
      sessionService.getSession({
        organization: other.scope.organization,
        sessionKey: record!.ctx.session_key!
      })
    ).rejects.toThrow();
  });
});

describe('session list', () => {
  it('pages sessions by last activity in both directions and filters them', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);

    for (let index = 0; index < 3; index++) {
      await harness.ingest([
        { type: 'session.start', at: minutesAfter(start, index), sessionId: `list-${index}` }
      ]);
    }
    await harness.ingest([
      { type: 'session.end', at: minutesAfter(start, 5), sessionId: 'list-0' }
    ]);

    let organization = harness.scope.organization;

    let page = await sessionService.listSessions({ organization, filters: {}, limit: 2 });
    expect(page.items.map(session => session.startedAt)).toEqual([
      start,
      minutesAfter(start, 2)
    ]);
    expect(page).toMatchObject({ hasMoreAfter: true, hasMoreBefore: false });

    let next = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 2,
      after: page.after
    });
    expect(next.items.map(session => session.startedAt)).toEqual([minutesAfter(start, 1)]);
    expect(next).toMatchObject({ hasMoreAfter: false, hasMoreBefore: true, after: undefined });

    let keys = (await sessionService.listSessions({ organization, filters: {} })).items.map(
      session => session._id
    );
    expect(keys).toHaveLength(3);

    let after = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 1,
      after: keys[0]
    });
    expect(after.items.map(session => session._id)).toEqual([keys[1]]);
    expect(after).toMatchObject({ hasMoreAfter: true, hasMoreBefore: true });

    let back = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 1,
      before: after.before
    });
    expect(back.items.map(session => session._id)).toEqual([keys[0]]);

    let forward = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 1,
      after: after.after
    });
    expect(forward.items.map(session => session._id)).toEqual([keys[2]]);

    let before = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 1,
      before: keys[2]
    });
    expect(before.items.map(session => session._id)).toEqual([keys[1]]);
    expect(before).toMatchObject({ hasMoreAfter: true, hasMoreBefore: true });

    let firstPage = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 2,
      before: keys[2]
    });
    expect(firstPage.items.map(session => session._id)).toEqual([keys[0], keys[1]]);
    expect(firstPage).toMatchObject({ hasMoreAfter: true, hasMoreBefore: false });

    let ascending = await sessionService.listSessions({
      organization,
      filters: {},
      order: 'asc'
    });
    expect(ascending.items.map(session => session._id)).toEqual([...keys].reverse());

    let endedOnly = await sessionService.listSessions({
      organization,
      filters: { states: ['ended'] },
      after: keys[1]
    });
    expect(endedOnly).toMatchObject({ items: [], hasMoreAfter: false, hasMoreBefore: true });

    await expect(
      sessionService.listSessions({ organization, filters: {}, after: 'no-such-session' })
    ).rejects.toThrow('Unknown session list anchor');
    await expect(
      sessionService.listSessions({
        organization,
        filters: { instanceIds: ['atin_another_instance'] },
        after: keys[0]
      })
    ).rejects.toThrow('Unknown session list anchor');
    await expect(
      sessionService.listSessions({
        organization,
        filters: {},
        after: keys[0],
        before: keys[2]
      })
    ).rejects.toThrow('Pass only one of after and before.');

    let ended = await sessionService.listSessions({
      organization,
      filters: { states: ['ended'] }
    });
    expect(ended.items).toHaveLength(1);

    let none = await sessionService.listSessions({
      organization,
      filters: { userIds: ['aten_someone_else'] }
    });
    expect(none.items).toHaveLength(0);

    let ranged = await sessionService.listSessions({
      organization,
      filters: { from: minutesAfter(start, 1), to: minutesAfter(start, 2) }
    });
    expect(ranged.items.map(session => session.startedAt)).toEqual([minutesAfter(start, 1)]);
  });

  it('pages from the positions it returned after the anchor session gets new activity', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);

    for (let index = 0; index < 4; index++) {
      await harness.ingest([
        { type: 'session.start', at: minutesAfter(start, index), sessionId: `moving-${index}` }
      ]);
    }

    let organization = harness.scope.organization;

    let all = (await sessionService.listSessions({ organization, filters: {} })).items.map(
      session => session._id
    );
    let second = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 2,
      after: (await sessionService.listSessions({ organization, filters: {}, limit: 1 })).after
    });
    expect(second.items.map(session => session._id)).toEqual([all[1], all[2]]);

    await harness.ingest([
      { type: 'turn.completed', at: minutesAfter(start, 30), sessionId: 'moving-2' },
      { type: 'turn.completed', at: minutesAfter(start, 31), sessionId: 'moving-1' }
    ]);

    let previous = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 1,
      before: second.before
    });
    expect(previous.items.map(session => session._id)).toEqual([all[0]]);
    expect(previous.hasMoreBefore).toBe(true);

    let next = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 2,
      after: second.after
    });
    expect(next.items.map(session => session._id)).toEqual([all[3]]);
    expect(next.hasMoreAfter).toBe(false);
  });

  it('settles ties on last activity by key, in both orders and directions', async () => {
    let harness = await createSessionHarness();
    let at = new Date(Date.now() - 60 * 60 * 1000);

    for (let index = 0; index < 3; index++) {
      await harness.ingest([{ type: 'session.start', at, sessionId: `tied-${index}` }]);
    }

    let organization = harness.scope.organization;
    let ids = (page: { items: { _id: string }[] }) => page.items.map(session => session._id);
    let keys = ids(await sessionService.listSessions({ organization, filters: {} }));
    expect(keys).toEqual([...keys].sort().reverse());

    for (let [order, listed] of [
      ['desc', keys],
      ['asc', [...keys].reverse()]
    ] as const) {
      let list = (page: { after?: string; before?: string }) =>
        sessionService.listSessions({ organization, filters: {}, order, limit: 1, ...page });

      let page = await list({});
      let seen = ids(page);
      while (page.hasMoreAfter) {
        page = await list({ after: page.after });
        seen.push(...ids(page));
      }
      expect(seen).toEqual(listed);

      let back = await list({ before: page.before });
      expect(ids(back)).toEqual([listed[1]]);
      expect(back).toMatchObject({ hasMoreAfter: true, hasMoreBefore: true });

      let byKey = await list({ after: listed[0] });
      expect(ids(byKey)).toEqual([listed[1]]);
    }
  });
});

describe('session list by cost', () => {
  it('pages by cost in both directions, sessions without a cost last, within a range of last activity', async () => {
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);
    let costs = ['0.5', null, '12', '0.000000125', '0.5', undefined];

    for (let index = 0; index < costs.length; index++) {
      await harness.ingest([
        { type: 'session.start', at: minutesAfter(start, index), sessionId: `cost-${index}` }
      ]);
    }

    let organization = harness.scope.organization;
    let { sessions } = harness.collections();
    let byStart = (
      await sessionService.listSessions({ organization, filters: {}, order: 'asc' })
    ).items.map(session => session._id);

    for (let [index, cost] of costs.entries()) {
      if (cost === undefined) continue;
      await sessions.updateOne(
        { _id: byStart[index] },
        {
          $set: {
            'summary.costUsd':
              cost === null ? null : mongoose.Types.Decimal128.fromString(cost)
          }
        }
      );
    }

    let keysDescending = (indexes: number[]) =>
      indexes
        .map(index => byStart[index]!)
        .sort()
        .reverse();
    let expected = [
      byStart[2]!,
      ...keysDescending([0, 4]),
      byStart[3]!,
      ...keysDescending([1, 5])
    ];

    let all = await sessionService.listSessions({
      organization,
      filters: {},
      orderBy: 'cost'
    });
    expect(all.items.map(session => session._id)).toEqual(expected);

    let seen: string[] = [];
    let page = await sessionService.listSessions({
      organization,
      filters: {},
      orderBy: 'cost',
      limit: 2
    });
    seen.push(...page.items.map(session => session._id));
    while (page.hasMoreAfter) {
      page = await sessionService.listSessions({
        organization,
        filters: {},
        orderBy: 'cost',
        limit: 2,
        after: page.after
      });
      seen.push(...page.items.map(session => session._id));
    }
    expect(seen).toEqual(expected);
    expect(page.hasMoreBefore).toBe(true);

    let back = await sessionService.listSessions({
      organization,
      filters: {},
      orderBy: 'cost',
      limit: 2,
      before: page.before
    });
    expect(back.items.map(session => session._id)).toEqual(expected.slice(2, 4));

    let byKey = await sessionService.listSessions({
      organization,
      filters: {},
      orderBy: 'cost',
      limit: 1,
      after: expected[3]
    });
    expect(byKey.items.map(session => session._id)).toEqual([expected[4]]);

    let cheapest = await sessionService.listSessions({
      organization,
      filters: {},
      orderBy: 'cost',
      order: 'asc',
      limit: 3
    });
    expect(cheapest.items.map(session => session._id)).toEqual(
      [...expected].reverse().slice(0, 3)
    );

    let ids = (page: { items: { _id: string }[] }) => page.items.map(session => session._id);
    let flags = (pages: { hasMoreBefore: boolean; hasMoreAfter: boolean }[]) =>
      pages.map(page => [page.hasMoreBefore, page.hasMoreAfter]);

    for (let order of ['desc', 'asc'] as const) {
      let listed = order == 'desc' ? expected : [...expected].reverse();

      for (let limit of [1, 2]) {
        let chunks: string[][] = [];
        for (let index = 0; index < listed.length; index += limit) {
          chunks.push(listed.slice(index, index + limit));
        }
        let chunkFlags = chunks.map((_, index) => [index > 0, index < chunks.length - 1]);

        let list = (anchor: { after?: string; before?: string }) =>
          sessionService.listSessions({
            organization,
            filters: {},
            orderBy: 'cost',
            order,
            limit,
            ...anchor
          });

        let forward = [await list({})];
        while (forward.at(-1)!.hasMoreAfter) {
          forward.push(await list({ after: forward.at(-1)!.after }));
        }
        expect(forward.map(ids)).toEqual(chunks);
        expect(flags(forward)).toEqual(chunkFlags);

        let backward = [forward.at(-1)!];
        while (backward[0]!.hasMoreBefore) {
          backward.unshift(await list({ before: backward[0]!.before }));
        }
        expect(backward.map(ids)).toEqual(chunks);
        expect(flags(backward)).toEqual(chunkFlags);
      }
    }

    let ranged = await sessionService.listSessions({
      organization,
      filters: {
        lastActivityFrom: minutesAfter(start, 2),
        lastActivityTo: minutesAfter(start, 5)
      },
      orderBy: 'cost'
    });
    expect(ranged.items.map(session => session._id)).toEqual(
      expected.filter(key => [2, 3, 4].includes(byStart.indexOf(key)))
    );

    await expect(
      sessionService.listSessions({
        organization,
        filters: {},
        orderBy: 'cost',
        after: (await sessionService.listSessions({ organization, filters: {}, limit: 1 }))
          .after
      })
    ).rejects.toThrow('Unknown session list anchor');
  });
});

describe('source health', () => {
  it('tracks the last time each source kind was seen per device and family', async () => {
    let harness = await createSessionHarness();
    let first = new Date(Date.now() - 60 * 1000);
    let second = new Date();

    await harness.ingest(
      [{ type: 'turn.completed', at: first, sessionId: 'health-1' }],
      first
    );
    await harness.ingest(
      [
        { type: 'model.request', at: second, sessionId: 'health-1', channel: 'otlp.logs' },
        { type: 'model.request', at: second, sessionId: 'health-1', channel: 'otlp.traces' }
      ],
      second
    );
    await harness.ingest(
      [{ type: 'turn.completed', at: first, sessionId: 'health-1' }],
      first
    );

    let health = await harness.collections().sourceHealth.findOne({
      _id: `${harness.scope.instance.id}:aten_device_unit:claude-code`
    });

    expect(health).toMatchObject({
      organizationId: harness.scope.organization.id,
      instanceId: harness.scope.instance.id,
      deviceId: 'aten_device_unit',
      family: 'claude-code',
      clientVersion: '2.1.0',
      lastSeen: { hook: first, otel: { logs: second, spans: second } }
    });
    expect(health!.updatedAt).toEqual(second);
  });

  it('counts unknown events per dialect and name instead of storing them', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    await harness.ingest(
      [
        {
          type: 'unmapped',
          at,
          sessionId: 'drift-1',
          channel: 'otlp.logs',
          data: { native_name: 'hook_registered', category: 'diagnostic' }
        },
        {
          type: 'unmapped',
          at,
          sessionId: 'drift-1',
          channel: 'otlp.logs',
          data: { native_name: 'hook_registered', category: 'diagnostic' }
        },
        {
          type: 'extension.event',
          at,
          sessionId: 'drift-1',
          channel: 'otlp.logs',
          data: { kind: 'plugin', action: 'loaded' }
        },
        {
          type: 'extension.event',
          at,
          sessionId: 'drift-1',
          channel: 'otlp.logs',
          data: { kind: 'skill', action: 'activated' }
        },
        { type: 'model.request', at, sessionId: 'drift-1', channel: 'otlp.logs' }
      ],
      at
    );

    let health = await harness.collections().sourceHealth.findOne({
      _id: `${harness.scope.instance.id}:aten_device_unit:claude-code`
    });
    expect(health!.unmapped).toEqual({ test_v1: { hook_registered: 2 } });

    let stored = await harness
      .collections()
      .events.find({ instanceId: harness.scope.instance.id })
      .toArray();
    expect(stored.map(event => [event.type, event.data?.kind ?? null]).sort()).toEqual([
      ['extension.event', 'skill'],
      ['model.request', null]
    ]);

    expect(
      await harness
        .collections()
        .sessions.countDocuments({ instanceId: harness.scope.instance.id })
    ).toBe(1);
  });

  it('creates no session for a client start that sends nothing we store', async () => {
    let harness = await createSessionHarness();
    let at = new Date();

    let records = await harness.ingest(
      [
        {
          type: 'unmapped',
          at,
          sessionId: 'probe-1',
          channel: 'otlp.logs',
          data: { native_name: 'managed_settings_resolved', category: 'diagnostic' }
        },
        {
          type: 'extension.event',
          at,
          sessionId: 'probe-1',
          channel: 'otlp.logs',
          data: { kind: 'plugin', action: 'loaded' }
        }
      ],
      at
    );

    expect(records[0]!.ctx.session_key).toBeTruthy();

    let filter = { instanceId: harness.scope.instance.id };
    expect(await harness.collections().sessions.countDocuments(filter)).toBe(0);
    expect(await harness.collections().sessionLinks.countDocuments(filter)).toBe(0);
    expect(await harness.collections().events.countDocuments(filter)).toBe(0);

    let health = await harness.collections().sourceHealth.findOne({
      _id: `${harness.scope.instance.id}:aten_device_unit:claude-code`
    });
    expect(health!.unmapped).toEqual({ test_v1: { managed_settings_resolved: 1 } });

    await harness.ingest(
      [{ type: 'model.request', at, sessionId: 'probe-1', channel: 'otlp.logs' }],
      at
    );

    expect(await harness.collections().sessions.countDocuments(filter)).toBe(1);
  });
});
