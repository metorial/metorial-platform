import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderAuthConfigQueue = createQueue<{ providerAuthConfigId: string }>({
  name: 'sub/auth/sidx/providerAuthConfig',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderAuthConfigQueueProcessor = indexProviderAuthConfigQueue.process(
  async data => {
    let providerAuthConfig = await db.providerAuthConfig.findUnique({
      where: { id: data.providerAuthConfigId },
      include: { tenant: true, provider: true, deployment: true }
    });
    if (!providerAuthConfig) throw new QueueRetryError();

    if (!providerAuthConfig.name && !providerAuthConfig.description) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerAuthConfig.id,
        documentIds: [providerAuthConfig.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerAuthConfig.id,

      documentId: providerAuthConfig.id,
      tenantIds: [providerAuthConfig.tenant.id],

      fields: { providerId: providerAuthConfig.provider.id, configId: providerAuthConfig.id },
      body: {
        name: providerAuthConfig.name,
        description: providerAuthConfig.description,
        providerName: providerAuthConfig.provider.name,
        deploymentName: providerAuthConfig.deployment?.name
      }
    });
  }
);
