import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

let callbackInstanceArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cb/cron/callbackInstanceArchivedCleanup',
  cron: '30 1 * * *',
  manyQueueName: 'sub/cb/delete/callbackInstance/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.callbackInstance.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids =>
    callbackInstanceDeleteQueue.addMany(ids.map(id => ({ callbackInstanceId: id })))
});

export let callbackInstanceArchivedCleanupCron = callbackInstanceArchivedCleanup.cron;
export let callbackInstanceDeleteManyQueue = callbackInstanceArchivedCleanup.manyQueue;
export let callbackInstanceDeleteManyQueueProcessor =
  callbackInstanceArchivedCleanup.manyProcessor;

export let callbackInstanceDeleteQueue = createQueue<{ callbackInstanceId: string }>({
  name: 'sub/cb/delete/callbackInstance',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
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
