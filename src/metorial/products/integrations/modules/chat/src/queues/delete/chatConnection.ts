import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';
import { chatConnectionDeletedQueue } from '../lifecycle/chatConnection';
import { getCutoffDate } from './_config';

export let chatConnectionArchivedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/integrationArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatConnectionDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatConnectionDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/integration/many',
  redisUrl: env.service.REDIS_URL
});

export let chatConnectionDeleteManyQueueProcessor = chatConnectionDeleteManyQueue.process(
  async data => {
    let chatConnections = await db.chatConnection.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (chatConnections.length === 0) return;

    await chatConnectionDeleteQueue.addMany(
      chatConnections.map(chatConnection => ({
        chatConnectionId: chatConnection.id
      }))
    );

    let lastChatConnection = chatConnections[chatConnections.length - 1];
    if (!lastChatConnection) return;

    await chatConnectionDeleteManyQueue.add({
      cursor: lastChatConnection.id
    });
  }
);

export let chatConnectionDeleteQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/delete/integration',
  redisUrl: env.service.REDIS_URL
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
