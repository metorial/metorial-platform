import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';
import { chatInstanceDeletedQueue } from '../lifecycle/chatConnection';

let chatInstanceArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cht/cron/integrationInstanceArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/cht/delete/integrationInstance/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.chatInstance.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => chatInstanceDeleteQueue.addMany(ids.map(id => ({ chatInstanceId: id })))
});

export let chatInstanceArchivedCleanupCron = chatInstanceArchivedCleanup.cron;
export let chatInstanceDeleteManyQueue = chatInstanceArchivedCleanup.manyQueue;
export let chatInstanceDeleteManyQueueProcessor = chatInstanceArchivedCleanup.manyProcessor;

export let chatInstanceDeleteQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/delete/integrationInstance',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts({ max: 5, duration: 1000 })
});

export let chatInstanceDeleteQueueProcessor = chatInstanceDeleteQueue.process(async data => {
  let chatInstance = await db.chatInstance.findUnique({
    where: { id: data.chatInstanceId }
  });
  if (!chatInstance || chatInstance.status !== 'archived') return;

  await deleteChatsWhere({ chatInstanceOid: chatInstance.oid });

  await db.chatInstanceProvider.updateMany({
    where: {
      chatInstanceOid: chatInstance.oid,
      status: { not: 'deleted' }
    },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      privateMetadata: {}
    }
  });

  await db.chatInstance.updateMany({
    where: { oid: chatInstance.oid },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      privateMetadata: {}
    }
  });

  await chatInstanceDeletedQueue.add({
    chatInstanceId: chatInstance.id
  });
});
