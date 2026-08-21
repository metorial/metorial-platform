import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexChatIntegrationQueue } from '../search/chatIntegration';
import { indexChatIntegrationInstanceQueue } from '../search/chatIntegrationInstance';

export let chatIntegrationCreatedQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/lc/integration/created',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationCreated = (chatIntegrationId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationCreatedQueue.add({ chatIntegrationId });
  });

export let chatIntegrationCreatedQueueProcessor = chatIntegrationCreatedQueue.process(
  async data => {
    await indexChatIntegrationQueue.add({ chatIntegrationId: data.chatIntegrationId });
  }
);

export let chatIntegrationUpdatedQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/lc/integration/updated',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationUpdated = (chatIntegrationId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationUpdatedQueue.add({ chatIntegrationId });
  });

export let chatIntegrationUpdatedQueueProcessor = chatIntegrationUpdatedQueue.process(
  async data => {
    await indexChatIntegrationQueue.add({ chatIntegrationId: data.chatIntegrationId });
  }
);

export let chatIntegrationArchivedQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/lc/integration/archived',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationArchived = (chatIntegrationId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationArchivedQueue.add({ chatIntegrationId });
  });

export let chatIntegrationArchivedQueueProcessor = chatIntegrationArchivedQueue.process(
  async data => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { id: data.chatIntegrationId }
    });
    if (!chatIntegration || chatIntegration.status !== 'archived') return;

    await indexChatIntegrationQueue.add({ chatIntegrationId: data.chatIntegrationId });
    await chatIntegrationArchiveInstancesManyQueue.add({
      chatIntegrationId: data.chatIntegrationId
    });
    await chatIntegrationArchiveProvidersManyQueue.add({
      chatIntegrationId: data.chatIntegrationId
    });
  }
);

export let chatIntegrationArchiveInstancesManyQueue = createQueue<{
  chatIntegrationId: string;
  cursor?: string;
}>({
  name: 'sub/cht/lc/integration/archiveInstancesMany',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationArchiveInstancesManyQueueProcessor =
  chatIntegrationArchiveInstancesManyQueue.process(async data => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { id: data.chatIntegrationId }
    });
    if (!chatIntegration || chatIntegration.status !== 'archived') return;

    let instances = await db.chatIntegrationInstance.findMany({
      where: {
        chatIntegrationOid: chatIntegration.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (instances.length === 0) return;

    let archivedAt = chatIntegration.archivedAt ?? new Date();

    await db.chatIntegrationInstance.updateMany({
      where: { oid: { in: instances.map(instance => instance.oid) } },
      data: { isParentDeleted: true }
    });
    await db.chatIntegrationInstance.updateMany({
      where: {
        oid: { in: instances.map(instance => instance.oid) },
        status: { not: 'deleted' }
      },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatIntegrationInstanceProvider.updateMany({
      where: {
        chatIntegrationInstanceOid: { in: instances.map(instance => instance.oid) },
        status: { not: 'deleted' }
      },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });

    await indexChatIntegrationInstanceQueue.addMany(
      instances.map(instance => ({ chatIntegrationInstanceId: instance.id }))
    );

    let lastInstance = instances[instances.length - 1];
    if (!lastInstance) return;

    await chatIntegrationArchiveInstancesManyQueue.add({
      chatIntegrationId: data.chatIntegrationId,
      cursor: lastInstance.id
    });
  });

export let chatIntegrationArchiveProvidersManyQueue = createQueue<{
  chatIntegrationId: string;
  cursor?: string;
}>({
  name: 'sub/cht/lc/integration/archiveProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let chatIntegrationArchiveProvidersManyQueueProcessor =
  chatIntegrationArchiveProvidersManyQueue.process(async data => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { id: data.chatIntegrationId }
    });
    if (!chatIntegration || chatIntegration.status !== 'archived') return;

    let providers = await db.chatIntegrationProvider.findMany({
      where: {
        chatIntegrationOid: chatIntegration.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 1000,
      select: { oid: true, id: true }
    });
    if (providers.length === 0) return;

    let archivedAt = chatIntegration.archivedAt ?? new Date();

    await db.chatIntegrationProvider.updateMany({
      where: { oid: { in: providers.map(provider => provider.oid) } },
      data: { status: 'archived', archivedAt }
    });

    await indexChatIntegrationQueue.add({ chatIntegrationId: data.chatIntegrationId });

    let lastProvider = providers[providers.length - 1];
    if (!lastProvider) return;

    await chatIntegrationArchiveProvidersManyQueue.add({
      chatIntegrationId: data.chatIntegrationId,
      cursor: lastProvider.id
    });
  });

export let chatIntegrationDeletedQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/lc/integration/deleted',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationDeleted = (chatIntegrationId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationDeletedQueue.add({ chatIntegrationId });
  });

export let chatIntegrationDeletedQueueProcessor = chatIntegrationDeletedQueue.process(
  async data => {
    await indexChatIntegrationQueue.add({ chatIntegrationId: data.chatIntegrationId });
  }
);

export let chatIntegrationInstanceCreatedQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/created',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationInstanceCreated = (chatIntegrationInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationInstanceCreatedQueue.add({ chatIntegrationInstanceId });
  });

export let chatIntegrationInstanceCreatedQueueProcessor =
  chatIntegrationInstanceCreatedQueue.process(async data => {
    await indexChatIntegrationInstanceQueue.add({
      chatIntegrationInstanceId: data.chatIntegrationInstanceId
    });
  });

export let chatIntegrationInstanceUpdatedQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/updated',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationInstanceUpdated = (chatIntegrationInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationInstanceUpdatedQueue.add({ chatIntegrationInstanceId });
  });

export let chatIntegrationInstanceUpdatedQueueProcessor =
  chatIntegrationInstanceUpdatedQueue.process(async data => {
    await indexChatIntegrationInstanceQueue.add({
      chatIntegrationInstanceId: data.chatIntegrationInstanceId
    });
  });

export let chatIntegrationInstanceArchivedQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/archived',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationInstanceArchived = (chatIntegrationInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationInstanceArchivedQueue.add({ chatIntegrationInstanceId });
  });

export let chatIntegrationInstanceArchivedQueueProcessor =
  chatIntegrationInstanceArchivedQueue.process(async data => {
    let chatIntegrationInstance = await db.chatIntegrationInstance.findUnique({
      where: { id: data.chatIntegrationInstanceId }
    });
    if (!chatIntegrationInstance || chatIntegrationInstance.status !== 'archived') return;

    let archivedAt = chatIntegrationInstance.archivedAt ?? new Date();

    await db.chatIntegrationInstanceProvider.updateMany({
      where: {
        chatIntegrationInstanceOid: chatIntegrationInstance.oid,
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt
      }
    });

    await indexChatIntegrationInstanceQueue.add({
      chatIntegrationInstanceId: data.chatIntegrationInstanceId
    });
  });

export let chatIntegrationInstanceDeletedQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/deleted',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatIntegrationInstanceDeleted = (chatIntegrationInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatIntegrationInstanceDeletedQueue.add({ chatIntegrationInstanceId });
  });

export let chatIntegrationInstanceDeletedQueueProcessor =
  chatIntegrationInstanceDeletedQueue.process(async data => {
    await indexChatIntegrationInstanceQueue.add({
      chatIntegrationInstanceId: data.chatIntegrationInstanceId
    });
  });
