import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatIntegrationDeletedQueue } from '../lifecycle/chatIntegration';
import { getCutoffDate } from './_config';

export let chatIntegrationArchivedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/integrationArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatIntegrationDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatIntegrationDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/integration/many',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationDeleteManyQueueProcessor = chatIntegrationDeleteManyQueue.process(
  async data => {
    let chatIntegrations = await db.chatIntegration.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (chatIntegrations.length === 0) return;

    await chatIntegrationDeleteQueue.addMany(
      chatIntegrations.map(chatIntegration => ({
        chatIntegrationId: chatIntegration.id
      }))
    );

    let lastChatIntegration = chatIntegrations[chatIntegrations.length - 1];
    if (!lastChatIntegration) return;

    await chatIntegrationDeleteManyQueue.add({
      cursor: lastChatIntegration.id
    });
  }
);

export let chatIntegrationDeleteQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/delete/integration',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationDeleteQueueProcessor = chatIntegrationDeleteQueue.process(
  async data => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { id: data.chatIntegrationId }
    });
    if (!chatIntegration || chatIntegration.status !== 'archived') return;

    await db.chatIntegrationInstanceProvider.updateMany({
      where: { chatIntegrationOid: chatIntegration.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await db.chatIntegrationInstance.updateMany({
      where: { chatIntegrationOid: chatIntegration.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await db.chatIntegrationProvider.updateMany({
      where: { chatIntegrationOid: chatIntegration.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });

    await db.chatIntegration.updateMany({
      where: { oid: chatIntegration.oid },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await chatIntegrationDeletedQueue.add({ chatIntegrationId: chatIntegration.id });
  }
);
