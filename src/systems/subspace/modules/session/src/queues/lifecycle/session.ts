import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let sessionCreatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/created',
  redisUrl: env.service.REDIS_URL
});

export let sessionCreatedQueueProcessor = sessionCreatedQueue.process(async data => {});

export let sessionUpdatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/updated',
  redisUrl: env.service.REDIS_URL
});

export let sessionUpdatedQueueProcessor = sessionUpdatedQueue.process(async data => {});

export let sessionArchivedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/archived',
  redisUrl: env.service.REDIS_URL
});

export let sessionArchivedQueueProcessor = sessionArchivedQueue.process(async data => {
  let session = await db.session.findUnique({
    where: { id: data.sessionId }
  });
  if (!session) return;

  await db.sessionConnection.updateMany({
    where: { sessionOid: session.oid, status: 'active' },
    data: {
      status: 'archived',
      state: 'disconnected',
      disconnectedAt: new Date()
    }
  });

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
  await db.sessionEvent.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
  await db.sessionMessage.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
  await db.sessionWarning.updateMany({
    where: { sessionOid: session.oid },
    data: { isParentDeleted: true }
  });
});

export let sessionDeletedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/deleted',
  redisUrl: env.service.REDIS_URL
});

export let sessionDeletedQueueProcessor = sessionDeletedQueue.process(async data => {
  // Nothing to do here
});
