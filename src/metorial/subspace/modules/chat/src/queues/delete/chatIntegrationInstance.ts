import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';
import { chatIntegrationInstanceDeletedQueue } from '../lifecycle/chatIntegration';
import { getCutoffDate } from './_config';

export let chatIntegrationInstanceArchivedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/integrationInstanceArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatIntegrationInstanceDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatIntegrationInstanceDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/integrationInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationInstanceDeleteManyQueueProcessor =
  chatIntegrationInstanceDeleteManyQueue.process(async data => {
    let instances = await db.chatIntegrationInstance.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (instances.length === 0) return;

    await chatIntegrationInstanceDeleteQueue.addMany(
      instances.map(instance => ({
        chatIntegrationInstanceId: instance.id
      }))
    );

    let lastInstance = instances[instances.length - 1];
    if (!lastInstance) return;

    await chatIntegrationInstanceDeleteManyQueue.add({
      cursor: lastInstance.id
    });
  });

export let chatIntegrationInstanceDeleteQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/delete/integrationInstance',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationInstanceDeleteQueueProcessor =
  chatIntegrationInstanceDeleteQueue.process(async data => {
    let chatIntegrationInstance = await db.chatIntegrationInstance.findUnique({
      where: { id: data.chatIntegrationInstanceId }
    });
    if (!chatIntegrationInstance || chatIntegrationInstance.status !== 'archived') return;

    await deleteChatsWhere({ chatIntegrationInstanceOid: chatIntegrationInstance.oid });

    await db.chatIntegrationInstanceProvider.updateMany({
      where: {
        chatIntegrationInstanceOid: chatIntegrationInstance.oid,
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

    await db.chatIntegrationInstance.updateMany({
      where: { oid: chatIntegrationInstance.oid },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await chatIntegrationInstanceDeletedQueue.add({
      chatIntegrationInstanceId: chatIntegrationInstance.id
    });
  });
