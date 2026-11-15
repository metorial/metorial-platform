import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import type { Organization, Project } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { planImpactRun } from '../lib/impacts';
import { rebuildItem } from '../lib/item';
import { countRebuildItems, organizationBehindLayers, rebuildPage } from '../lib/pages';
import { parseRebuildCursor, rebuildTargetOf, serializeRebuildCursor } from '../lib/plan';
import {
  activeRebuildStatuses,
  completeRebuildRunIfFinished,
  createRebuildRun,
  failRebuildRun,
  finishRebuildItem,
  getRebuildRun,
  queueRebuildRun
} from '../lib/runs';
import {
  catalogRebuildReason,
  type RebuildImpact,
  type RebuildLayer,
  versionRebuildReason
} from '@mtsrc/agent-tracking-layers';

let pageSize = 500;
let scanStaleMs = 30 * 60 * 1000;
let drainStaleMs = 6 * 60 * 60 * 1000;
let impactLayers: RebuildLayer[] = ['summary', 'facts'];

export type RebuildTrigger =
  { type: 'version' } | { type: 'catalog'; impacts: RebuildImpact[] };

let isFinalAttempt = (job: { attemptsMade: number; opts: { attempts?: number } }) =>
  job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

let errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export let rebuildManyQueue = createQueue<{ rebuildRunId: string }>({
  name: 'at/rebuild/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let rebuildSingleQueue = createQueue<{ rebuildRunId: string; sessionKey: string }>({
  name: 'at/rebuild/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

// The run row holds the whole state (status, cursor, counts), so any job can pick it up after a
// restart. The cursor only moves when it still holds the value this job read, which keeps a
// duplicated job from skipping or repeating a page.
export let advanceRebuildRun = async (d: {
  rebuildRunId: string;
}): Promise<{ more: boolean }> => {
  let run = await getRebuildRun(d.rebuildRunId);
  if (!run || !activeRebuildStatuses.includes(run.status)) return { more: false };

  let target = rebuildTargetOf(run);

  if (run.status == 'queued') {
    let total = await countRebuildItems(target);

    // A queued run can be widened by `queueRebuildRun` until it starts; if that happened since
    // it was read, start again from the widened row.
    let started = await db.rebuildRun.updateMany({
      where: { oid: run.oid, status: 'queued', updatedAt: run.updatedAt },
      data: { status: 'running', total }
    });
    if (!started.count) return await advanceRebuildRun(d);
  }

  let cursor = parseRebuildCursor(run.cursor);
  if (cursor.phase == 'done') {
    await completeRebuildRunIfFinished(run.oid);
    return { more: false };
  }

  let page = await rebuildPage({ target, cursor });

  if (page.keys.length) {
    await rebuildSingleQueue.addManyWithOps(
      page.keys.map(sessionKey => ({
        data: { rebuildRunId: run.id, sessionKey },
        opts: { id: `${run.id}:${sessionKey}` }
      }))
    );
  }

  let done = page.cursor.phase == 'done';

  let advanced = await db.rebuildRun.updateMany({
    where: { oid: run.oid, status: 'running', cursor: run.cursor },
    data: {
      cursor: serializeRebuildCursor(page.cursor),
      ...(done ? { total: page.cursor.enqueued } : {})
    }
  });
  if (!advanced.count) return { more: false };

  if (done) await completeRebuildRunIfFinished(run.oid);

  return { more: !done };
};

export let rebuildManyProcessor = rebuildManyQueue.process(async (data, job) => {
  try {
    let { more } = await advanceRebuildRun(data);

    if (more) await rebuildManyQueue.add(data, hourlyPacedDelay());
  } catch (error) {
    if (isFinalAttempt(job)) {
      let run = await getRebuildRun(data.rebuildRunId);
      if (run) await failRebuildRun({ oid: run.oid, error: errorMessage(error) });
    }

    throw error;
  }
});

// A failing item is retried; once its retries run out it still counts as processed, with its
// error kept on the run, so the run can finish.
export let processRebuildItem = async (
  d: { rebuildRunId: string; sessionKey: string },
  opts: { finalAttempt: boolean } = { finalAttempt: true }
) => {
  let run = await getRebuildRun(d.rebuildRunId);
  if (!run || run.status != 'running') return null;

  try {
    let result = await rebuildItem({ target: rebuildTargetOf(run), sessionKey: d.sessionKey });

    await finishRebuildItem({ oid: run.oid });

    return result;
  } catch (error) {
    if (opts.finalAttempt) {
      await finishRebuildItem({
        oid: run.oid,
        error: `${d.sessionKey}: ${errorMessage(error)}`
      });
    }

    throw error;
  }
};

export let rebuildSingleProcessor = rebuildSingleQueue.process(async (data, job) => {
  await processRebuildItem(data, { finalAttempt: isFinalAttempt(job) });
});

export let rebuildOrganizationsManyQueue = createQueue<{
  trigger: RebuildTrigger;
  cursor?: string;
}>({
  name: 'at/rebuild/organizations/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let rebuildOrganizationsManyProcessor = rebuildOrganizationsManyQueue.process(
  async data => {
    let organizations = await db.organization.findMany({
      where: { archivedAt: null, id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });

    if (!organizations.length) return;

    await rebuildOrganizationsSingleQueue.addMany(
      organizations.map(organization => ({
        organizationId: organization.id,
        trigger: data.trigger
      }))
    );

    if (organizations.length == pageSize) {
      await rebuildOrganizationsManyQueue.add(
        { ...data, cursor: organizations[organizations.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

export let rebuildOrganizationsSingleQueue = createQueue<{
  organizationId: string;
  trigger: RebuildTrigger;
}>({
  name: 'at/rebuild/organizations/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

// Knowledge and override impacts (08 §8): only a scope with matching data gets a run, and a
// queued run for the same scope and reason is widened instead of duplicated.
export let startImpactRebuild = async (d: {
  organization: Organization;
  project?: Project | null;
  impacts: RebuildImpact[];
  reason: string;
  now?: Date;
}) => {
  let planned = await planImpactRun({
    organization: d.organization,
    project: d.project,
    impacts: d.impacts,
    layers: impactLayers,
    now: d.now ?? new Date()
  });
  if (!planned) return null;

  let { run, created } = await queueRebuildRun({
    organization: d.organization,
    project: d.project,
    range: planned.range,
    layers: impactLayers,
    reason: d.reason,
    filter: planned.filter
  });
  if (created) await rebuildManyQueue.add({ rebuildRunId: run.id });

  return run;
};

// A newer version run covers everything an older one still has queued, so the older one stops.
export let startOrganizationRebuild = async (d: {
  organizationId: string;
  trigger: RebuildTrigger;
}) => {
  let organization = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!organization || organization.archivedAt) return null;

  if (d.trigger.type == 'catalog') {
    return await startImpactRebuild({
      organization,
      impacts: d.trigger.impacts,
      reason: catalogRebuildReason
    });
  }

  let layers = await organizationBehindLayers(organization.id);
  if (!layers.length) return null;

  await db.rebuildRun.updateMany({
    where: {
      organizationOid: organization.oid,
      reason: versionRebuildReason,
      status: { in: activeRebuildStatuses }
    },
    data: { status: 'cancelled', completedAt: new Date() }
  });

  let run = await createRebuildRun({
    organization,
    range: { from: new Date(0), to: new Date() },
    layers,
    reason: versionRebuildReason
  });
  await rebuildManyQueue.add({ rebuildRunId: run.id });

  return run;
};

export let rebuildOrganizationsSingleProcessor = rebuildOrganizationsSingleQueue.process(
  async data => {
    await startOrganizationRebuild(data);
  }
);

// Jobs live in Redis; if they are lost, a run whose scan stalled is resumed from its cursor.
// A run that finished scanning but whose items stopped finishing is failed instead, since the
// lost items can't be told apart; a new run redoes them.
export let resumeStaleRebuildRuns = async (d: { now: Date }) => {
  let runs = await db.rebuildRun.findMany({
    where: {
      status: { in: activeRebuildStatuses },
      updatedAt: { lt: new Date(d.now.getTime() - scanStaleMs) }
    },
    orderBy: { updatedAt: 'asc' },
    take: pageSize
  });

  let resumed: string[] = [];

  for (let run of runs) {
    if (parseRebuildCursor(run.cursor).phase != 'done') {
      resumed.push(run.id);
      continue;
    }

    if (run.updatedAt.getTime() < d.now.getTime() - drainStaleMs) {
      await failRebuildRun({
        oid: run.oid,
        error: `${(run.total ?? 0) - run.processed} items did not finish; start a new run to redo them.`
      });
    }
  }

  await rebuildManyQueue.addMany(resumed.map(rebuildRunId => ({ rebuildRunId })));

  return { resumed };
};

export let rebuildResumeCron = createCron(
  {
    name: 'at/rebuild/resume',
    cron: '*/15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await resumeStaleRebuildRuns({ now: new Date() });
  }
);

export let rebuildProcessor = combineQueueProcessors([
  rebuildManyProcessor,
  rebuildSingleProcessor,
  rebuildOrganizationsManyProcessor,
  rebuildOrganizationsSingleProcessor,
  rebuildResumeCron
]);
