import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexChatConnectionQueue = createQueue<{ chatConnectionId: string }>({
  name: 'sub/cht/sidx/integration',
  redisUrl: env.service.REDIS_URL
});

export let indexChatConnectionQueueProcessor = indexChatConnectionQueue.process(async data => {
  let chatConnection = await db.chatConnection.findUnique({
    where: { id: data.chatConnectionId },
    include: {
      tenant: true,
      providers: {
        where: { status: 'active' }
      }
    }
  });
  if (!chatConnection) throw new QueueRetryError();

  if (
    chatConnection.status !== 'active' ||
    (!chatConnection.name && !chatConnection.description)
  ) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.chatConnection.id,
      documentIds: [chatConnection.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.chatConnection.id,

    documentId: chatConnection.id,
    tenantIds: [chatConnection.tenant.id],

    fields: {
      chatConnectionId: chatConnection.id
    },

    body: {
      name: chatConnection.name,
      description: chatConnection.description,
      slug: chatConnection.slug,
      providerNames: chatConnection.providers.map(provider => provider.name)
    }
  });
});
