import { createQueue, pacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { recordConnectionTimeUsage } from '@metorial/module-usage';
import { env } from '../../env';

let PARENT_DELETED_BATCH_SIZE = 1000;

export let sessionCreatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let sessionCreatedQueueProcessor = sessionCreatedQueue.process(async data => {});

export let sessionUpdatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let sessionUpdatedQueueProcessor = sessionUpdatedQueue.process(async data => {});

export let sessionArchivedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/archived',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let sessionArchivedQueueProcessor = sessionArchivedQueue.process(async data => {
  let session = await db.session.findUnique({
    where: { id: data.sessionId }
  });
  if (!session) return;

  let connectedConnections = await db.sessionConnection.findMany({
    where: { sessionOid: session.oid, status: 'active', state: 'connected' },
    include: {
      participant: {
        select: { id: true, type: true, agentInstanceOid: true, identityActorOid: true }
      }
    }
  });
  let disconnectedAt = new Date();

  await db.sessionConnection.updateMany({
    where: { sessionOid: session.oid, status: 'active' },
    data: {
      status: 'archived',
      state: 'disconnected',
      disconnectedAt
    }
  });

  for (let connection of connectedConnections) {
    await recordConnectionTimeUsage({ ...connection, disconnectedAt, session });
  }

  await db.providerRun.updateMany({
    where: { sessionOid: session.oid, status: 'running' },
    data: {
      status: 'stopped',
      completedAt: new Date(),
      isParentDeleted: true
    }
  });

  await db.sessionProviderInstance.updateMany({
    where: { sessionOid: session.oid },
    data: { expiresAt: new Date() }
  });

  await db.session.updateMany({
    where: { oid: session.oid },
    data: {
      connectionState: 'disconnected',
      lastActiveAt: new Date()
    }
  });

  await db.sessionProvider.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
  await db.sessionConnection.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true, status: 'deleted' }
  });
  await db.providerRun.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
  await db.sessionError.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
  await db.sessionWarning.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });

  await sessionArchivedChildrenQueue.addMany([
    { sessionId: session.id, target: 'sessionEvent' },
    { sessionId: session.id, target: 'sessionMessage' }
  ]);
});

// Messages and events can number in the hundreds of thousands per session, so they are
// flagged in oid-ordered chunks rather than in a single long-locking updateMany.
export let sessionArchivedChildrenQueue = createQueue<{
  sessionId: string;
  target: 'sessionEvent' | 'sessionMessage';
  cursor?: string;
}>({
  name: 'sub/ses/lc/session/archived/children',
  workerOpts: { concurrency: 5 },
  redisUrl: env.service.REDIS_URL
});

export let sessionArchivedChildrenQueueProcessor = sessionArchivedChildrenQueue.process(
  async data => {
    let session = await db.session.findUnique({
      where: { id: data.sessionId },
      select: { oid: true }
    });
    if (!session) return;

    let where = {
      sessionOid: session.oid,
      isParentDeleted: false,
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
    };
    let findArgs = {
      where,
      orderBy: { oid: 'asc' as const },
      take: PARENT_DELETED_BATCH_SIZE,
      select: { oid: true }
    };

    let rows =
      data.target === 'sessionEvent'
        ? await db.sessionEvent.findMany(findArgs)
        : await db.sessionMessage.findMany(findArgs);
    if (!rows.length) return;

    let update = {
      where: { oid: { in: rows.map(row => row.oid) } },
      data: { isParentDeleted: true }
    };

    if (data.target === 'sessionEvent') await db.sessionEvent.updateMany(update);
    else await db.sessionMessage.updateMany(update);

    if (rows.length === PARENT_DELETED_BATCH_SIZE) {
      await sessionArchivedChildrenQueue.add(
        { ...data, cursor: rows[rows.length - 1]!.oid.toString() },
        pacedDelay({ baseMs: 50, jitterMs: 200 })
      );
    }
  }
);

export let sessionDeletedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/deleted',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let sessionDeletedQueueProcessor = sessionDeletedQueue.process(async data => {
  // Nothing to do here
});
