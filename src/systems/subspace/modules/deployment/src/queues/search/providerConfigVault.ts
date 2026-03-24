import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderConfigVaultQueue = createQueue<{ providerConfigVaultId: string }>({
  name: 'sub/dep/sidx/providerConfigVault',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderConfigVaultQueueProcessor = indexProviderConfigVaultQueue.process(
  async data => {
    let providerConfigVault = await db.providerConfigVault.findUnique({
      where: { id: data.providerConfigVaultId },
      include: { tenant: true, provider: true, deployment: true }
    });
    if (!providerConfigVault) throw new QueueRetryError();

    if (!providerConfigVault.name && !providerConfigVault.description) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.providerConfigVault.id,
        documentIds: [providerConfigVault.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerConfigVault.id,

      documentId: providerConfigVault.id,
      tenantIds: [providerConfigVault.tenant.id],

      fields: {
        providerId: providerConfigVault.provider.id,
        configId: providerConfigVault.id
      },
      body: {
        name: providerConfigVault.name,
        description: providerConfigVault.description,
        providerName: providerConfigVault.provider.name,
        deploymentName: providerConfigVault.deployment?.name
      }
    });
  }
);
