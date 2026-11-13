import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTRIBUTION_VERSION } from '../../attribution/versions';
import { collections, daysAgo, setupScope, slice } from '../../attribution/tests/fixtures';
import { sessionlessKey } from '../../facts/slices';
import { FACTS_VERSION } from '../../facts/versions';
import { writeSessionFacts } from '../../facts/write';
import {
  advanceRebuildRun,
  processRebuildItem,
  rebuildManyQueue,
  rebuildOrganizationsManyQueue,
  rebuildSingleQueue,
  startOrganizationRebuild
} from '../../queues/rebuild';
import { createSessionHarness, minutesAfter, store } from '../../sessions/tests/harness';
import { closeSessionRedis, tryRedis } from '../../sessions/redis';
import { SUMMARY_VERSION } from '../../sessions/versions';
import { cleanDatabase, testDb } from '../../test/setup';
import { rebuildRunService } from '../service';
import { startVersionRebuildsOnce, versionRebuildGuardKey } from '../triggers';

let model = { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic' };

// Runs the rebuild queues inline: items queued by a page finish before the next page is read.
let inlineRebuildQueues = () => {
  let pages: string[] = [];
  let items: { rebuildRunId: string; sessionKey: string }[] = [];

  vi.spyOn(rebuildManyQueue, 'add').mockImplementation((async (job: {
    rebuildRunId: string;
  }) => {
    pages.push(job.rebuildRunId);
  }) as never);
  vi.spyOn(rebuildSingleQueue, 'addManyWithOps').mockImplementation((async (
    jobs: { data: { rebuildRunId: string; sessionKey: string } }[]
  ) => {
    items.push(...jobs.map(job => job.data));
  }) as never);

  let drain = async () => {
    while (pages.length || items.length) {
      while (items.length) await processRebuildItem(items.shift()!);

      let rebuildRunId = pages.shift();
      if (!rebuildRunId) continue;

      let { more } = await advanceRebuildRun({ rebuildRunId });
      if (more) pages.push(rebuildRunId);
    }
  };

  return { pages, items, drain };
};

let getRun = (oid: bigint) => testDb.rebuildRun.findUniqueOrThrow({ where: { oid } });

describe('rebuild', () => {
  beforeAll(async () => {
    await store.ready();
  });

  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeSessionRedis();
    await store.close();
  });

  it('rebuilds attribution for sessions and sessionless buckets in range', async () => {
    let queues = inlineRebuildQueues();
    let scope = await setupScope();

    let recent = await scope.session({ startedAt: daysAgo(2) });
    let older = await scope.session({ startedAt: daysAgo(5) });
    let outside = await scope.session({ startedAt: daysAgo(40) });

    let bucket = daysAgo(3);
    let key = sessionlessKey(scope.instance.id, bucket);
    await writeSessionFacts({ sessionKey: key, slices: [slice({ bucket })] });

    let { sessions, usageSlices } = await collections();
    await usageSlices.updateMany({ sessionlessKey: key }, { $set: { attributionVersion: 0 } });

    let run = await rebuildRunService.startRebuildRun({
      organization: scope.organization,
      input: { range: { from: daysAgo(10), to: new Date() }, layers: ['attribution'] }
    });
    expect(run).toMatchObject({ status: 'queued', layers: ['attribution'], reason: 'manual' });
    expect(queues.pages).toEqual([run.id]);

    await queues.drain();

    expect(await getRun(run.oid)).toMatchObject({
      status: 'completed',
      processed: 3,
      total: 3,
      error: null
    });

    for (let session of [recent, older]) {
      let stored = (await sessions.findOne({ _id: session._id }))!;
      expect(stored.versions.attribution).toBe(ATTRIBUTION_VERSION);
      expect(stored.attribution?.version).toBe(ATTRIBUTION_VERSION);
    }
    expect((await sessions.findOne({ _id: outside._id }))!.versions.attribution).toBe(0);
    expect((await usageSlices.findOne({ sessionlessKey: key }))!.attributionVersion).toBe(
      ATTRIBUTION_VERSION
    );
  });

  it('stops a cancelled run', async () => {
    let queues = inlineRebuildQueues();
    let scope = await setupScope();

    let keys = [
      (await scope.session({ startedAt: daysAgo(1) }))._id,
      (await scope.session({ startedAt: daysAgo(2) }))._id,
      (await scope.session({ startedAt: daysAgo(3) }))._id
    ];

    let run = await rebuildRunService.startRebuildRun({
      organization: scope.organization,
      input: { range: { from: daysAgo(10), to: new Date() }, layers: ['attribution'] }
    });

    expect(await advanceRebuildRun({ rebuildRunId: run.id })).toEqual({ more: true });
    expect(queues.items.map(item => item.sessionKey)).toEqual(keys);
    expect(await getRun(run.oid)).toMatchObject({ status: 'running', total: 3 });

    await processRebuildItem(queues.items.shift()!);

    let cancelled = await rebuildRunService.cancelRebuildRun({
      rebuildRun: await rebuildRunService.getRebuildRunById({
        organization: scope.organization,
        rebuildRunId: run.id
      })
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).not.toBeNull();

    queues.pages.length = 0;
    expect(await processRebuildItem(queues.items[0]!)).toBeNull();
    expect(await advanceRebuildRun({ rebuildRunId: run.id })).toEqual({ more: false });

    expect(await getRun(run.oid)).toMatchObject({ status: 'cancelled', processed: 1 });

    let { sessions } = await collections();
    let versions = await Promise.all(
      keys.map(async key => (await sessions.findOne({ _id: key }))!.versions.attribution)
    );
    expect(versions).toEqual([ATTRIBUTION_VERSION, 0, 0]);

    let again = await rebuildRunService.cancelRebuildRun({ rebuildRun: cancelled });
    expect(again.status).toBe('cancelled');
  });

  it('freezes sessions whose records expired and only rebuilds their attribution', async () => {
    let queues = inlineRebuildQueues();
    let harness = await createSessionHarness();
    let start = new Date(Date.now() - 60 * 60 * 1000);

    let [record] = await harness.ingest([
      { type: 'session.start', at: start, sessionId: 'live-1' },
      {
        type: 'model.request',
        at: minutesAfter(start, 1),
        sessionId: 'live-1',
        data: { model, usage: { inputUncached: 100, output: 10 } }
      }
    ]);
    let liveKey = record!.ctx.session_key!;

    let startedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    let frozenKey = crypto.randomUUID().replace(/-/g, '');
    await harness.collections().sessions.insertOne({
      _id: frozenKey,
      organizationId: harness.scope.organization.id,
      projectId: harness.scope.project.id,
      instanceId: harness.scope.instance.id,
      origin: 'native',
      versions: { summary: 0, attribution: 0, facts: 0 },
      client: { family: 'claude-code' },
      rootSessionKey: frozenKey,
      startedAt,
      lastActivityAt: startedAt,
      lastObservedAt: startedAt,
      state: 'ended',
      observed: { clientUserIds: [], clientInstallationIds: [] },
      context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false },
      expiresAt: new Date(startedAt.getTime() + 400 * 24 * 60 * 60 * 1000)
    });

    let run = await rebuildRunService.startRebuildRun({
      organization: harness.scope.organization,
      input: {
        range: { from: daysAgo(200), to: new Date() },
        layers: ['summary', 'attribution']
      }
    });

    await advanceRebuildRun({ rebuildRunId: run.id });
    let results = new Map<string, unknown>();
    for (let item of queues.items.splice(0)) {
      results.set(item.sessionKey, await processRebuildItem(item));
    }
    await queues.drain();

    expect(results.get(liveKey)).toEqual({
      frozen: false,
      layers: ['attribution', 'summary']
    });
    expect(results.get(frozenKey)).toEqual({ frozen: true, layers: ['attribution'] });
    expect(await getRun(run.oid)).toMatchObject({
      status: 'completed',
      processed: 2,
      total: 2
    });

    let live = (await harness.session(liveKey))!;
    expect(live.frozen).toBeUndefined();
    expect(live.versions).toMatchObject({
      summary: SUMMARY_VERSION,
      attribution: ATTRIBUTION_VERSION,
      facts: FACTS_VERSION
    });
    expect(live.summary?.requests).toBe(1);

    let frozen = (await harness.session(frozenKey))!;
    expect(frozen.frozen).toBe(true);
    expect(frozen.summary).toBeUndefined();
    expect(frozen.versions).toMatchObject({ summary: 0, attribution: ATTRIBUTION_VERSION });
  });

  it('starts version runs for layers that are behind, once per version tuple', async () => {
    let queues = inlineRebuildQueues();
    let scope = await setupScope();

    let session = await scope.session({ startedAt: daysAgo(4) });

    let run = await startOrganizationRebuild({
      organizationId: scope.organization.id,
      trigger: { type: 'version' }
    });
    expect(run).toMatchObject({ reason: 'version_upgrade', layers: ['attribution', 'facts'] });

    await queues.drain();

    expect(await getRun(run!.oid)).toMatchObject({ status: 'completed', processed: 1 });

    let { sessions } = await collections();
    let stored = (await sessions.findOne({ _id: session._id }))!;
    expect(stored.versions).toEqual({
      summary: SUMMARY_VERSION,
      attribution: ATTRIBUTION_VERSION,
      facts: FACTS_VERSION
    });

    expect(
      await startOrganizationRebuild({
        organizationId: scope.organization.id,
        trigger: { type: 'version' }
      })
    ).toBeNull();

    let started = vi
      .spyOn(rebuildOrganizationsManyQueue, 'add')
      .mockImplementation((async () => {}) as never);
    await tryRedis(redis => redis.del(versionRebuildGuardKey()));

    expect(await startVersionRebuildsOnce()).toBe(true);
    expect(await startVersionRebuildsOnce()).toBe(false);
    expect(started).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledWith({ trigger: { type: 'version' } });
  });

  it('starts catalog runs only for organizations with data in range', async () => {
    inlineRebuildQueues();
    let scope = await setupScope();
    let empty = await setupScope();

    await scope.session({ startedAt: daysAgo(3) });

    let trigger = {
      type: 'catalog' as const,
      from: daysAgo(7).toISOString(),
      to: new Date().toISOString()
    };

    expect(
      await startOrganizationRebuild({ organizationId: scope.organization.id, trigger })
    ).toMatchObject({ reason: 'catalog_change', layers: ['summary', 'facts'] });
    expect(
      await startOrganizationRebuild({ organizationId: empty.organization.id, trigger })
    ).toBeNull();
  });
});
