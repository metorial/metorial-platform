import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatInstanceProviderQueue = createQueue<{
  chatInstanceProviderId: string;
}>({
  name: 'sub/cht/sidx/chatInstanceProvider',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let enqueueIndexChatInstanceProvider = (chatInstanceProviderId: string) =>
  addAfterTransactionHook(async () => {
    await indexChatInstanceProviderQueue.add({ chatInstanceProviderId });
  });

export let indexChatInstanceProviderQueueProcessor = indexChatInstanceProviderQueue.process(
  async data => {
    let chatInstanceProvider = await db.chatInstanceProvider.findUnique({
      where: { id: data.chatInstanceProviderId },
      include: {
        tenant: true,
        chatInstance: true,
        chatConnectionProvider: true
      }
    });

    if (
      !chatInstanceProvider ||
      chatInstanceProvider.status !== 'active' ||
      chatInstanceProvider.isParentDeleted
    ) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.chatInstanceProvider.id,
        documentIds: [data.chatInstanceProviderId]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatInstanceProvider.id,
      documentId: chatInstanceProvider.id,
      tenantIds: [chatInstanceProvider.tenant.id],
      fields: {
        chatInstanceProviderId: chatInstanceProvider.id,
        chatInstanceId: chatInstanceProvider.chatInstance.id,
        chatConnectionProviderId: chatInstanceProvider.chatConnectionProvider.id
      },
      body: {
        name: chatInstanceProvider.name,
        description: chatInstanceProvider.description,
        chatInstanceName: chatInstanceProvider.chatInstance.name,
        chatConnectionProviderName: chatInstanceProvider.chatConnectionProvider.name
      }
    });
  }
);

export let indexChatInstanceProvidersManyQueue = createQueue<{
  chatInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/cht/sidx/chatInstanceProvidersMany',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let indexChatInstanceProvidersManyQueueProcessor =
  indexChatInstanceProvidersManyQueue.process(async data => {
    let providers = await db.chatInstanceProvider.findMany({
      where: {
        chatInstance: { id: data.chatInstanceId },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providers.length === 0) return;

    await indexChatInstanceProviderQueue.addMany(
      providers.map(provider => ({ chatInstanceProviderId: provider.id }))
    );

    if (providers.length === 100) {
      await indexChatInstanceProvidersManyQueue.add({
        chatInstanceId: data.chatInstanceId,
        cursor: providers[providers.length - 1]!.id
      });
    }
  });
