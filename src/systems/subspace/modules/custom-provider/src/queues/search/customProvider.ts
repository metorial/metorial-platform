import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexCustomProviderQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/sidx/customProvider',
  redisUrl: env.service.REDIS_URL
});

export let indexCustomProviderQueueProcessor = indexCustomProviderQueue.process(async data => {
  let customProvider = await db.customProvider.findUnique({
    where: { id: data.customProviderId },
    include: { tenant: true, provider: true }
  });
  if (!customProvider) throw new QueueRetryError();

  if (!customProvider.name && !customProvider.description) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.customProvider.id,
      documentIds: [customProvider.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.customProvider.id,

    documentId: customProvider.id,
    tenantIds: [customProvider.tenant.id],

    fields: { customProvider: customProvider.id },
    body: {
      name: customProvider.name,
      description: customProvider.description
    }
  });
});
