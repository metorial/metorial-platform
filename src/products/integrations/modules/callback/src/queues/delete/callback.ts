import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexCallbackQueue } from '../search/callback';

let callbackArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cb/cron/callbackArchivedCleanup',
  cron: '15 1 * * *',
  manyQueueName: 'sub/cb/delete/callback/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.callback.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => callbackDeleteQueue.addMany(ids.map(id => ({ callbackId: id })))
});

export let callbackArchivedCleanupCron = callbackArchivedCleanup.cron;
export let callbackDeleteManyQueue = callbackArchivedCleanup.manyQueue;
export let callbackDeleteManyQueueProcessor = callbackArchivedCleanup.manyProcessor;

export let callbackDeleteQueue = createQueue<{ callbackId: string }>({
  name: 'sub/cb/delete/callback',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let callbackDeleteQueueProcessor = callbackDeleteQueue.process(async data => {
  let callback = await db.callback.findUnique({
    where: { id: data.callbackId },
    select: { oid: true, status: true }
  });
  if (!callback || callback.status !== 'archived') return;

  await db.callback.update({
    where: { oid: callback.oid },
    data: { status: 'deleted' }
  });

  await indexCallbackQueue.add({ callbackId: data.callbackId });
});
