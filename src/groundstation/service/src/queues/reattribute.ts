import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import type mongoose from 'mongoose';
import { invalidateAttributionContext } from '../attribution/context';
import { reattributeSession } from '../attribution/session';
import { env } from '../env';
import { getStore } from '../store/connection';

let pageSize = 500;

export type ReattributionJob = {
  organizationId: string;
  since: string;
  entityIds?: string[];
  scope?: { projectId?: string; instanceId?: string };
  phase?: 'sessions' | 'sessionless';
  cursor?: { startedAt?: string; id: string };
};

type RawCollection = mongoose.mongo.Collection<mongoose.mongo.Document>;

let raw = (collection: unknown) => collection as RawCollection;

export let reattributeManyQueue = createQueue<ReattributionJob>({
  name: 'gs/attribution/reattribute/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reattributeSingleQueue = createQueue<{
  sessionKey: string;
  organizationId: string;
}>({
  name: 'gs/attribution/reattribute/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export type MergeRemapJob = {
  organizationId: string;
  winnerId: string;
  loserId: string;
  late?: boolean;
};

export let mergeRemapQueue = createQueue<MergeRemapJob>({
  name: 'gs/attribution/merge',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reattributionPage = async (
  job: ReattributionJob
): Promise<{ keys: string[]; next: ReattributionJob | null }> => {
  let store = getStore();
  await store.ready();

  let collections = store.collections();
  let since = new Date(job.since);
  let scope = {
    ...(job.scope?.projectId ? { projectId: job.scope.projectId } : {}),
    ...(job.scope?.instanceId ? { instanceId: job.scope.instanceId } : {})
  };

  if ((job.phase ?? 'sessions') == 'sessions') {
    let cursor = job.cursor?.startedAt ? new Date(job.cursor.startedAt) : null;

    let sessions = await collections.sessions
      .find(
        {
          organizationId: job.organizationId,
          startedAt: { $gte: since },
          ...scope,
          ...(job.entityIds ? { 'attribution.dimIds': { $in: job.entityIds } } : {}),
          ...(cursor
            ? {
                $or: [
                  { startedAt: { $lt: cursor } },
                  { startedAt: cursor, _id: { $gt: job.cursor!.id } }
                ]
              }
            : {})
        },
        { projection: { _id: 1, startedAt: 1 } }
      )
      .sort({ startedAt: -1, _id: 1 })
      .limit(pageSize)
      .toArray();

    let last = sessions[sessions.length - 1];

    if (sessions.length == pageSize && last) {
      return {
        keys: sessions.map(session => session._id),
        next: { ...job, cursor: { startedAt: last.startedAt.toISOString(), id: last._id } }
      };
    }

    return {
      keys: sessions.map(session => session._id),
      next: job.entityIds?.length ? { ...job, phase: 'sessionless', cursor: undefined } : null
    };
  }

  let slices = await collections.usageSlices
    .find(
      {
        organizationId: job.organizationId,
        sessionlessKey: { $exists: true },
        dimIds: { $in: job.entityIds ?? [] },
        bucket: { $gte: since },
        ...scope,
        ...(job.cursor ? { _id: { $gt: job.cursor.id } } : {})
      },
      { projection: { _id: 1, sessionlessKey: 1 } }
    )
    .sort({ _id: 1 })
    .limit(pageSize)
    .toArray();

  let last = slices[slices.length - 1];

  return {
    keys: [...new Set(slices.map(slice => slice.sessionlessKey!))],
    next: slices.length == pageSize && last ? { ...job, cursor: { id: last._id } } : null
  };
};

export let reattributeManyProcessor = reattributeManyQueue.process(async data => {
  let page = await reattributionPage(data);

  if (page.keys.length) {
    await reattributeSingleQueue.addManyWithOps(
      page.keys.map(sessionKey => ({
        data: { sessionKey, organizationId: data.organizationId },
        opts: { id: sessionKey }
      }))
    );
  }

  if (page.next) await reattributeManyQueue.add(page.next, hourlyPacedDelay());
});

export let reattributeSingleProcessor = reattributeSingleQueue.process(async data => {
  await reattributeSession({
    sessionKey: data.sessionKey,
    organizationId: data.organizationId
  });
});

// 06 §5: raw records, sessions and slices that stamped the loser now point at the winner; the
// sessions are then re-attributed, which rewrites their dimIds and slice dims.
export let remapMergedEntity = async (d: MergeRemapJob) => {
  invalidateAttributionContext(d.organizationId);

  let store = getStore();
  await store.ready();

  let collections = store.collections();
  let organizationId = d.organizationId;

  let setScalar = async (
    collection: RawCollection,
    field: string,
    filter: mongoose.mongo.Filter<mongoose.mongo.Document> = {}
  ) => {
    await collection.updateMany(
      { ...filter, organizationId, [field]: d.loserId },
      { $set: { [field]: d.winnerId } }
    );
  };

  let replaceInArray = async (
    collection: RawCollection,
    field: string,
    filter: mongoose.mongo.Filter<mongoose.mongo.Document> = {}
  ) => {
    await collection.updateMany(
      { ...filter, organizationId, [field]: d.loserId },
      { $addToSet: { [field]: d.winnerId } }
    );
    await collection.updateMany(
      { ...filter, organizationId, [field]: d.loserId },
      { $pull: { [field]: d.loserId } as mongoose.mongo.PullOperator<mongoose.mongo.Document> }
    );
  };

  let recordFields = [
    'userId',
    'deviceId',
    'agentId',
    'clientUserId',
    'clientInstallationId',
    'repoId',
    'workspaceId'
  ];

  for (let collection of [collections.events, collections.measurements]) {
    for (let field of recordFields) await setScalar(raw(collection), `attribution.${field}`);
  }

  let sessions = raw(collections.sessions);
  let sessionScalars = ['observed.userId', 'observed.deviceId', 'observed.agentId'];
  let sessionArrays = [
    'observed.clientUserIds',
    'observed.clientInstallationIds',
    'context.workspaceIds',
    'context.repoIds'
  ];

  let stampedWithLoser = {
    organizationId,
    $or: [...sessionScalars, ...sessionArrays, 'manual.entityId'].map(field => ({
      [field]: d.loserId
    }))
  };

  // Sessions stamped after the merge never had the (already merged) loser in their dimIds, so
  // the ones remapped here are re-attributed by key rather than found through their dims. Each
  // page stops matching once remapped, so the loop always moves forward.
  while (true) {
    let page = await sessions
      .find(stampedWithLoser, { projection: { _id: 1 } })
      .limit(pageSize)
      .toArray();
    if (!page.length) break;

    let ids = { _id: { $in: page.map(session => session._id) } };

    for (let field of sessionScalars) await setScalar(sessions, field, ids);
    for (let field of sessionArrays) await replaceInArray(sessions, field, ids);
    await sessions.updateMany(
      { organizationId, ...ids, 'manual.entityId': d.loserId },
      { $set: { 'manual.$[assignment].entityId': d.winnerId } },
      { arrayFilters: [{ 'assignment.entityId': d.loserId }] }
    );

    await reattributeSingleQueue.addManyWithOps(
      page.map(session => ({
        data: { sessionKey: String(session._id), organizationId },
        opts: { id: String(session._id) }
      }))
    );

    if (page.length < pageSize) break;
  }

  let slices = raw(collections.usageSlices);

  for (let field of ['userId', 'deviceId', 'agentId', 'subagentId']) {
    await setScalar(slices, field);
  }
  for (let field of ['workspaceIds', 'repoIds']) await replaceInArray(slices, field);

  for (let field of ['userId', 'deviceId']) {
    await setScalar(raw(collections.sourceHealth), field);
  }

  await reattributeManyQueue.add({
    organizationId,
    since: new Date(0).toISOString(),
    entityIds: d.late ? [d.loserId] : [d.winnerId, d.loserId]
  });
};

export let mergeRemapProcessor = mergeRemapQueue.process(async data => {
  await remapMergedEntity(data);
});

export let reattributeProcessor = combineQueueProcessors([
  reattributeManyProcessor,
  reattributeSingleProcessor,
  mergeRemapProcessor
]);
