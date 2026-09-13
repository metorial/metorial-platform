import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { deleteChatsWhere } from '../../lib/chatLifecycle';
import { chatInstanceDeletedQueue } from '../lifecycle/chatConnection';
import { getCutoffDate } from './_config';

export let chatInstanceArchivedCleanupCron = createCron(
  {
    name: 'sub/cht/cron/integrationInstanceArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatInstanceDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let chatInstanceDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/delete/integrationInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let chatInstanceDeleteManyQueueProcessor = chatInstanceDeleteManyQueue.process(
  async data => {
    let instances = await db.chatInstance.findMany({
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

    await chatInstanceDeleteQueue.addMany(
      instances.map(instance => ({
        chatInstanceId: instance.id
      }))
    );

    let lastInstance = instances[instances.length - 1];
    if (!lastInstance) return;

    await chatInstanceDeleteManyQueue.add({
      cursor: lastInstance.id
    });
  }
);

export let chatInstanceDeleteQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/delete/integrationInstance',
  redisUrl: env.service.REDIS_URL
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
