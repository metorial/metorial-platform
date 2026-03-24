import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderConfigQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/sidx/providerConfig',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderConfigQueueProcessor = indexProviderConfigQueue.process(async data => {
  let providerConfig = await db.providerConfig.findUnique({
    where: { id: data.providerConfigId },
    include: { tenant: true, provider: true, deployment: true }
  });
  if (!providerConfig) throw new QueueRetryError();

  if (!providerConfig.name && !providerConfig.description) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerConfig.id,
      documentIds: [providerConfig.id]
    });
    return;
  }

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.providerConfig.id,

    documentId: providerConfig.id,
    tenantIds: [providerConfig.tenant.id],

    fields: { providerId: providerConfig.provider.id, configId: providerConfig.id },
    body: {
      name: providerConfig.name,
      description: providerConfig.description,
      providerName: providerConfig.provider.name,
      deploymentName: providerConfig.deployment?.name
    }
  });
});
