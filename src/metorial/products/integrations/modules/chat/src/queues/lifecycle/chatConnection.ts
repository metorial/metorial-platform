import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { archiveChatsWhere } from '../../lib/chatLifecycle';
import { indexChatConnectionQueue } from '../search/chatConnection';
import { indexChatInstanceQueue } from '../search/chatInstance';

export let chatConnectionCreatedQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/lc/integration/created',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatConnectionCreated = (chatConnectionId: string) =>
  addAfterTransactionHook(async () => {
    await chatConnectionCreatedQueue.add({ chatConnectionId });
  });

export let chatConnectionCreatedQueueProcessor = chatConnectionCreatedQueue.process(
  async data => {
    await indexChatConnectionQueue.add({ chatConnectionId: data.chatConnectionId });
  }
);

export let chatConnectionUpdatedQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/lc/integration/updated',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatConnectionUpdated = (chatConnectionId: string) =>
  addAfterTransactionHook(async () => {
    await chatConnectionUpdatedQueue.add({ chatConnectionId });
  });

export let chatConnectionUpdatedQueueProcessor = chatConnectionUpdatedQueue.process(
  async data => {
    await indexChatConnectionQueue.add({ chatConnectionId: data.chatConnectionId });
  }
);

export let chatConnectionArchivedQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/lc/integration/archived',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatConnectionArchived = (chatConnectionId: string) =>
  addAfterTransactionHook(async () => {
    await chatConnectionArchivedQueue.add({ chatConnectionId });
  });

export let chatConnectionArchivedQueueProcessor = chatConnectionArchivedQueue.process(
  async data => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { id: data.chatConnectionId }
    });
    if (!chatConnection || chatConnection.status !== 'archived') return;

    await indexChatConnectionQueue.add({ chatConnectionId: data.chatConnectionId });
    await chatConnectionArchiveInstancesManyQueue.add({
      chatConnectionId: data.chatConnectionId
    });
    await chatConnectionArchiveProvidersManyQueue.add({
      chatConnectionId: data.chatConnectionId
    });
  }
);

export let chatConnectionArchiveInstancesManyQueue = createQueue<{
  chatConnectionId: string;
  cursor?: string;
}>({
  name: 'sub/cht/lc/integration/archiveInstancesMany',
  redisUrl: env.service.REDIS_URL
});

export let chatConnectionArchiveInstancesManyQueueProcessor =
  chatConnectionArchiveInstancesManyQueue.process(async data => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { id: data.chatConnectionId }
    });
    if (!chatConnection || chatConnection.status !== 'archived') return;

    let instances = await db.chatInstance.findMany({
      where: {
        chatConnectionOid: chatConnection.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (instances.length === 0) return;

    let archivedAt = chatConnection.archivedAt ?? new Date();

    await db.chatInstance.updateMany({
      where: { oid: { in: instances.map(instance => instance.oid) } },
      data: { isParentDeleted: true }
    });
    await db.chatInstance.updateMany({
      where: {
        oid: { in: instances.map(instance => instance.oid) },
        status: { not: 'deleted' }
      },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatInstanceProvider.updateMany({
      where: {
        chatInstanceOid: { in: instances.map(instance => instance.oid) },
        status: { not: 'deleted' }
      },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await archiveChatsWhere(
      { chatInstanceOid: { in: instances.map(instance => instance.oid) } },
      archivedAt
    );

    await indexChatInstanceQueue.addMany(
      instances.map(instance => ({ chatInstanceId: instance.id }))
    );

    let lastInstance = instances[instances.length - 1];
    if (!lastInstance) return;

    await chatConnectionArchiveInstancesManyQueue.add({
      chatConnectionId: data.chatConnectionId,
      cursor: lastInstance.id
    });
  });

export let chatConnectionArchiveProvidersManyQueue = createQueue<{
  chatConnectionId: string;
  cursor?: string;
}>({
  name: 'sub/cht/lc/integration/archiveProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let chatConnectionArchiveProvidersManyQueueProcessor =
  chatConnectionArchiveProvidersManyQueue.process(async data => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { id: data.chatConnectionId }
    });
    if (!chatConnection || chatConnection.status !== 'archived') return;

    let providers = await db.chatConnectionProvider.findMany({
      where: {
        chatConnectionOid: chatConnection.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 1000,
      select: { oid: true, id: true }
    });
    if (providers.length === 0) return;

    let archivedAt = chatConnection.archivedAt ?? new Date();

    await db.chatConnectionProvider.updateMany({
      where: { oid: { in: providers.map(provider => provider.oid) } },
      data: { status: 'archived', archivedAt }
    });

    await indexChatConnectionQueue.add({ chatConnectionId: data.chatConnectionId });

    let lastProvider = providers[providers.length - 1];
    if (!lastProvider) return;

    await chatConnectionArchiveProvidersManyQueue.add({
      chatConnectionId: data.chatConnectionId,
      cursor: lastProvider.id
    });
  });

export let chatConnectionDeletedQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/lc/integration/deleted',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatConnectionDeleted = (chatConnectionId: string) =>
  addAfterTransactionHook(async () => {
    await chatConnectionDeletedQueue.add({ chatConnectionId });
  });

export let chatConnectionDeletedQueueProcessor = chatConnectionDeletedQueue.process(
  async data => {
    await indexChatConnectionQueue.add({ chatConnectionId: data.chatConnectionId });
  }
);

export let chatInstanceCreatedQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/created',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatInstanceCreated = (chatInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatInstanceCreatedQueue.add({ chatInstanceId });
  });

export let chatInstanceCreatedQueueProcessor = chatInstanceCreatedQueue.process(async data => {
  await indexChatInstanceQueue.add({
    chatInstanceId: data.chatInstanceId
  });
});

export let chatInstanceUpdatedQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/updated',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatInstanceUpdated = (chatInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatInstanceUpdatedQueue.add({ chatInstanceId });
  });

export let chatInstanceUpdatedQueueProcessor = chatInstanceUpdatedQueue.process(async data => {
  await indexChatInstanceQueue.add({
    chatInstanceId: data.chatInstanceId
  });
});

export let chatInstanceArchivedQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/archived',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatInstanceArchived = (chatInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatInstanceArchivedQueue.add({ chatInstanceId });
  });

export let chatInstanceArchivedQueueProcessor = chatInstanceArchivedQueue.process(
  async data => {
    let chatInstance = await db.chatInstance.findUnique({
      where: { id: data.chatInstanceId }
    });
    if (!chatInstance || chatInstance.status !== 'archived') return;

    let archivedAt = chatInstance.archivedAt ?? new Date();

    await db.chatInstanceProvider.updateMany({
      where: {
        chatInstanceOid: chatInstance.oid,
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt
      }
    });
    await archiveChatsWhere({ chatInstanceOid: chatInstance.oid }, archivedAt);

    await indexChatInstanceQueue.add({
      chatInstanceId: data.chatInstanceId
    });
  }
);

export let chatInstanceDeletedQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/lc/integrationInstance/deleted',
  redisUrl: env.service.REDIS_URL
});

export let enqueueChatInstanceDeleted = (chatInstanceId: string) =>
  addAfterTransactionHook(async () => {
    await chatInstanceDeletedQueue.add({ chatInstanceId });
  });

export let chatInstanceDeletedQueueProcessor = chatInstanceDeletedQueue.process(async data => {
  await indexChatInstanceQueue.add({
    chatInstanceId: data.chatInstanceId
  });
});
