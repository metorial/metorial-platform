import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatIntegrationInstanceQueue = createQueue<{
  chatIntegrationInstanceId: string;
}>({
  name: 'sub/cht/sidx/integrationInstance',
  redisUrl: env.service.REDIS_URL
});

export let indexChatIntegrationInstanceQueueProcessor =
  indexChatIntegrationInstanceQueue.process(async data => {
    let chatIntegrationInstance = await db.chatIntegrationInstance.findUnique({
      where: { id: data.chatIntegrationInstanceId },
      include: {
        tenant: true,
        chatIntegration: true,
        providers: {
          where: { status: 'active', isParentDeleted: false },
          include: { chatIntegrationProvider: true }
        }
      }
    });
    if (!chatIntegrationInstance) throw new QueueRetryError();

    if (
      chatIntegrationInstance.status !== 'active' ||
      chatIntegrationInstance.isParentDeleted ||
      (!chatIntegrationInstance.name && !chatIntegrationInstance.description)
    ) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.chatIntegrationInstance.id,
        documentIds: [chatIntegrationInstance.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatIntegrationInstance.id,

      documentId: chatIntegrationInstance.id,
      tenantIds: [chatIntegrationInstance.tenant.id],

      fields: {
        chatIntegrationInstanceId: chatIntegrationInstance.id,
        chatIntegrationId: chatIntegrationInstance.chatIntegration.id
      },
      body: {
        name: chatIntegrationInstance.name,
        description: chatIntegrationInstance.description,
        chatIntegrationName: chatIntegrationInstance.chatIntegration.name,
        chatIntegrationSlug: chatIntegrationInstance.chatIntegration.slug,
        providerNames: chatIntegrationInstance.providers.map(
          provider => provider.chatIntegrationProvider.name
        )
      }
    });
  });
