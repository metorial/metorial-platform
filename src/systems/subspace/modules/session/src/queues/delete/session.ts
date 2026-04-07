import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { sessionDeletedQueue } from '../lifecycle/session';
import { getCutoffDate } from './_config';

export let sessionArchivedCleanupCron = createCron(
  {
    name: 'sub/ses/cron/sessionArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await sessionDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let sessionDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ses/delete/session/many',
  redisUrl: env.service.REDIS_URL
});

export let sessionDeleteManyQueueProcessor = sessionDeleteManyQueue.process(async data => {
  let sessions = await db.session.findMany({
    where: {
      status: 'archived',
      archivedAt: { lt: getCutoffDate() },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (sessions.length === 0) return;

  await sessionDeleteQueue.addMany(sessions.map(session => ({ sessionId: session.id })));

  await sessionDeleteManyQueue.add({
    cursor: sessions[sessions.length - 1].id
  });
});

export let sessionDeleteQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/delete/session',
  redisUrl: env.service.REDIS_URL
});

export let sessionDeleteQueueProcessor = sessionDeleteQueue.process(async data => {
  let session = await db.session.findUnique({
    where: { id: data.sessionId }
  });
  if (!session || session.status !== 'archived') return;

  await db.sessionProvider.updateMany({
    where: { sessionOid: session.oid },
    data: { status: 'deleted', isParentDeleted: true }
  });
  await db.sessionConnection.updateMany({
    where: { sessionOid: session.oid },
    data: {
      status: 'deleted',
      isParentDeleted: true,
      state: 'disconnected',
      disconnectedAt: new Date()
    }
  });
  await db.providerRun.updateMany({
    where: { sessionOid: session.oid },
    data: {
      status: 'stopped',
      isParentDeleted: true,
      completedAt: new Date()
    }
  });
  await db.toolCall.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionEvent.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionMessage.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionWarning.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionError.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.providerRunUsageRecord.deleteMany({
    where: { providerRun: { sessionOid: session.oid } }
  });
  await db.providerRun.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionProviderInstance.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionUsageRecord.deleteMany({
    where: { sessionOid: session.oid }
  });

  await db.session.updateMany({
    where: { oid: session.oid },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      sharedProviderName: null,
      sharedProviderDescription: null,
      hasErrors: false,
      hasWarnings: false,
      isStarted: false,
      connectionState: 'disconnected',
      totalProductiveClientMessageCount: 0,
      totalProductiveProviderMessageCount: 0
    }
  });

  await sessionDeletedQueue.add({ sessionId: session.id });
});
