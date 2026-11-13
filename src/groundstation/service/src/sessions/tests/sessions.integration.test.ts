import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessionService } from '../../services';
import {
  correlationCacheKey,
  closeSessionRedis,
  getSessionRedis,
  inferCacheKey,
  summaryLockKey
} from '../redis';
import { settleSession } from '../settle';
import { createSessionHarness, minutesAfter, store } from './harness';

let dayMs = 24 * 60 * 60 * 1000;

let model = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

beforeAll(async () => {
  await store.ready();
});

afterAll(async () => {
  await closeSessionRedis();
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
      observed: { userId: 'gen_user_unit', deviceId: 'gen_device_unit' },
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
    context.attribution = { repo_id: 'gen_repo', workspace_id: 'gen_workspace' };

    let [record] = await harness.ingestRecords(
      [context, harness.draft({ type: 'turn.completed', at, sessionId: 'repo-1' }, at)],
      at
    );
    let sessionKey = record!.ctx.session_key!;

    expect((await harness.session(sessionKey))!.context).toMatchObject({
      repoIds: ['gen_repo'],
      workspaceIds: ['gen_workspace']
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

    await getSessionRedis().del(correlationCacheKey(linkId));

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

    let inferKey = `${harness.scope.instance.id}:claude-code:gen_device_unit`;
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

    await getSessionRedis().del(inferCacheKey(inferKey));

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
    expect(session.summary).toMatchObject({ turns: 1, requests: 1 });
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

    await getSessionRedis().set(summaryLockKey(sessionKey), '1', 'EX', 60);
    expect(
      (await sessionService.getSession({ organization, sessionKey })).summary?.turns
    ).toBe(99);
    await getSessionRedis().del(summaryLockKey(sessionKey));

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
  it('pages sessions newest first and filters them', async () => {
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
      minutesAfter(start, 2),
      minutesAfter(start, 1)
    ]);
    expect(page.hasMore).toBe(true);

    let next = await sessionService.listSessions({
      organization,
      filters: {},
      limit: 2,
      cursor: page.nextCursor!
    });
    expect(next.items.map(session => session.startedAt)).toEqual([start]);
    expect(next.hasMore).toBe(false);
    expect(next.nextCursor).toBeNull();

    let ended = await sessionService.listSessions({
      organization,
      filters: { states: ['ended'] }
    });
    expect(ended.items).toHaveLength(1);

    let none = await sessionService.listSessions({
      organization,
      filters: { userIds: ['gen_someone_else'] }
    });
    expect(none.items).toHaveLength(0);

    let ranged = await sessionService.listSessions({
      organization,
      filters: { from: minutesAfter(start, 1), to: minutesAfter(start, 2) }
    });
    expect(ranged.items.map(session => session.startedAt)).toEqual([minutesAfter(start, 1)]);
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
      _id: `${harness.scope.instance.id}:gen_device_unit:claude-code`
    });

    expect(health).toMatchObject({
      organizationId: harness.scope.organization.id,
      instanceId: harness.scope.instance.id,
      deviceId: 'gen_device_unit',
      family: 'claude-code',
      clientVersion: '2.1.0',
      lastSeen: { hook: first, otel: { logs: second, spans: second } }
    });
    expect(health!.updatedAt).toEqual(second);
  });
});
