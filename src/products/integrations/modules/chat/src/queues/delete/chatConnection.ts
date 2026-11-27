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
import { chatConnectionDeletedQueue } from '../lifecycle/chatConnection';

let chatConnectionArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cht/cron/integrationArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/cht/delete/integration/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.chatConnection.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => chatConnectionDeleteQueue.addMany(ids.map(id => ({ chatConnectionId: id })))
});

export let chatConnectionArchivedCleanupCron = chatConnectionArchivedCleanup.cron;
export let chatConnectionDeleteManyQueue = chatConnectionArchivedCleanup.manyQueue;
export let chatConnectionDeleteManyQueueProcessor =
  chatConnectionArchivedCleanup.manyProcessor;

export let chatConnectionDeleteQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/delete/integration',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts({ max: 5, duration: 1000 })
});

export let chatConnectionDeleteQueueProcessor = chatConnectionDeleteQueue.process(
  async data => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { id: data.chatConnectionId }
    });
    if (!chatConnection || chatConnection.status !== 'archived') return;

    await deleteChatsWhere({ chatConnectionOid: chatConnection.oid });

    await db.chatInstanceProvider.updateMany({
      where: { chatConnectionOid: chatConnection.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await db.chatInstance.updateMany({
      where: { chatConnectionOid: chatConnection.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await db.chatConnectionProvider.updateMany({
      where: { chatConnectionOid: chatConnection.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });

    await db.chatConnection.updateMany({
      where: { oid: chatConnection.oid },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await chatConnectionDeletedQueue.add({ chatConnectionId: chatConnection.id });
  }
);
