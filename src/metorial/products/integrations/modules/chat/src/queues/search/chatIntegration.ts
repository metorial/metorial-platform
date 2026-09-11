import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatIntegrationQueue = createQueue<{ chatIntegrationId: string }>({
  name: 'sub/cht/sidx/integration',
  redisUrl: env.service.REDIS_URL
});

export let indexChatIntegrationQueueProcessor = indexChatIntegrationQueue.process(
  async data => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { id: data.chatIntegrationId },
      include: {
        tenant: true,
        providers: {
          where: { status: 'active' }
        }
      }
    });
    if (!chatIntegration) throw new QueueRetryError();

    if (chatIntegration.status !== 'active' || (!chatIntegration.name && !chatIntegration.description)) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.chatIntegration.id,
        documentIds: [chatIntegration.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatIntegration.id,

      documentId: chatIntegration.id,
      tenantIds: [chatIntegration.tenant.id],

      fields: {
        chatIntegrationId: chatIntegration.id
      },

      body: {
        name: chatIntegration.name,
        description: chatIntegration.description,
        slug: chatIntegration.slug,
        providerNames: chatIntegration.providers.map(provider => provider.name)
      }
    });
  }
);
