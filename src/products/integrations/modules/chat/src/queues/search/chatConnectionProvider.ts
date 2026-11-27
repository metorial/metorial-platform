import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatConnectionProviderQueue = createQueue<{
  chatConnectionProviderId: string;
}>({
  name: 'sub/cht/sidx/chatConnectionProvider',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let enqueueIndexChatConnectionProvider = (chatConnectionProviderId: string) =>
  addAfterTransactionHook(async () => {
    await indexChatConnectionProviderQueue.add({ chatConnectionProviderId });
  });

export let indexChatConnectionProviderQueueProcessor =
  indexChatConnectionProviderQueue.process(async data => {
    let chatConnectionProvider = await db.chatConnectionProvider.findUnique({
      where: { id: data.chatConnectionProviderId },
      include: {
        tenant: true,
        chatConnection: true,
        adapterIntegrationProvider: {
          include: { integrationProvider: { include: { provider: true } } }
        }
      }
    });

    if (!chatConnectionProvider || chatConnectionProvider.status !== 'active') {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.chatConnectionProvider.id,
        documentIds: [data.chatConnectionProviderId]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatConnectionProvider.id,
      documentId: chatConnectionProvider.id,
      tenantIds: [chatConnectionProvider.tenant.id],
      fields: {
        chatConnectionProviderId: chatConnectionProvider.id,
        chatConnectionId: chatConnectionProvider.chatConnection.id,
        providerId:
          chatConnectionProvider.adapterIntegrationProvider.integrationProvider.provider.id
      },
      body: {
        name: chatConnectionProvider.name,
        description: chatConnectionProvider.description,
        chatConnectionName: chatConnectionProvider.chatConnection.name,
        providerName:
          chatConnectionProvider.adapterIntegrationProvider.integrationProvider.provider.name
      }
    });
  });
