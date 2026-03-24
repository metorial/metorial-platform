import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderDeploymentQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/sidx/providerDeployment',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderDeploymentQueueProcessor = indexProviderDeploymentQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId },
      include: { tenant: true, provider: true }
    });
    if (!providerDeployment) throw new QueueRetryError();

    if (!providerDeployment.name && !providerDeployment.description) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerDeployment.id,
        documentIds: [providerDeployment.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerDeployment.id,

      documentId: providerDeployment.id,
      tenantIds: [providerDeployment.tenant.id],

      fields: {
        providerId: providerDeployment.provider.id,
        configId: providerDeployment.id
      },
      body: {
        name: providerDeployment.name,
        description: providerDeployment.description,
        providerName: providerDeployment.provider.name
      }
    });
  }
);
