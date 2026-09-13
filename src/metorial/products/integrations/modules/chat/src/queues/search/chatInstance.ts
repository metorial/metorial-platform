import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatInstanceQueue = createQueue<{
  chatInstanceId: string;
}>({
  name: 'sub/cht/sidx/integrationInstance',
  redisUrl: env.service.REDIS_URL
});

export let indexChatInstanceQueueProcessor = indexChatInstanceQueue.process(async data => {
  let chatInstance = await db.chatInstance.findUnique({
    where: { id: data.chatInstanceId },
    include: {
      tenant: true,
      chatConnection: true,
      providers: {
        where: { status: 'active', isParentDeleted: false },
        include: { chatConnectionProvider: true }
      }
    }
  });
  if (!chatInstance) throw new QueueRetryError();

  if (
    chatInstance.status !== 'active' ||
    chatInstance.isParentDeleted ||
    (!chatInstance.name && !chatInstance.description)
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatInstance.id,
      documentIds: [chatInstance.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.chatInstance.id,

    documentId: chatInstance.id,
    tenantIds: [chatInstance.tenant.id],

    fields: {
      chatInstanceId: chatInstance.id,
      chatConnectionId: chatInstance.chatConnection.id
    },
    body: {
      name: chatInstance.name,
      description: chatInstance.description,
      chatConnectionName: chatInstance.chatConnection.name,
      chatConnectionSlug: chatInstance.chatConnection.slug,
      providerNames: chatInstance.providers.map(
        provider => provider.chatConnectionProvider.name
      )
    }
  });
});
