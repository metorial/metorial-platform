import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getCutoffDate } from './_config';

export let callbackInstanceArchivedCleanupCron = createCron(
  {
    name: 'sub/cb/cron/callbackInstanceArchivedCleanup',
    cron: '30 1 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await callbackInstanceDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let callbackInstanceDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cb/delete/callbackInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceDeleteManyQueueProcessor = callbackInstanceDeleteManyQueue.process(
  async data => {
    let callbackInstances = await db.callbackInstance.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (callbackInstances.length === 0) return;

    await callbackInstanceDeleteQueue.addMany(
      callbackInstances.map(callbackInstance => ({
        callbackInstanceId: callbackInstance.id
      }))
    );

    let last = callbackInstances[callbackInstances.length - 1];
    if (!last) return;

    await callbackInstanceDeleteManyQueue.add({ cursor: last.id });
  }
);

export let callbackInstanceDeleteQueue = createQueue<{ callbackInstanceId: string }>({
  name: 'sub/cb/delete/callbackInstance',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceDeleteQueueProcessor = callbackInstanceDeleteQueue.process(
  async data => {
    let callbackInstance = await db.callbackInstance.findUnique({
      where: { id: data.callbackInstanceId },
      select: { oid: true, status: true }
    });
    if (!callbackInstance || callbackInstance.status !== 'archived') return;

    await db.callbackInstance.update({
      where: { oid: callbackInstance.oid },
      data: { status: 'deleted' }
    });
  }
);
