import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexCallbackQueue = createQueue<{ callbackId: string }>({
  name: 'sub/cb/sidx/callback',
  redisUrl: env.service.REDIS_URL
});

export let indexCallbackQueueProcessor = indexCallbackQueue.process(async data => {
  let callback = await db.callback.findUnique({
    where: { id: data.callbackId },
    include: { tenant: true, integration: true, integrationProvider: true, provider: true }
  });
  if (!callback) throw new QueueRetryError();

  if (callback.status !== 'active') {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.callback.id,
      documentIds: [callback.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.callback.id,

    documentId: callback.id,
    tenantIds: [callback.tenant.id],

    fields: {
      callbackId: callback.id,
      integrationId: callback.integration.id,
      integrationProviderId: callback.integrationProvider.id,
      providerId: callback.provider.id
    },

    body: {
      name: callback.name,
      description: callback.description,
      integrationName: callback.integration.name,
      providerName: callback.provider.name
    }
  });
});
