import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexIntegrationInstanceQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/sidx/integrationInstance',
  redisUrl: env.service.REDIS_URL
});

export let indexIntegrationInstanceQueueProcessor = indexIntegrationInstanceQueue.process(
  async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId },
      include: {
        tenant: true,
        integration: true,
        integrationInstanceProviders: {
          where: { status: 'active', isParentDeleted: false },
          include: { integrationProvider: { include: { provider: true } } }
        }
      }
    });
    if (!integrationInstance) throw new QueueRetryError();

    if (
      integrationInstance.status !== 'active' ||
      integrationInstance.isParentDeleted ||
      (!integrationInstance.name && !integrationInstance.description)
    ) {
      await voyager.record.delete({
        sourceId: (await voyagerSource).id,
        indexId: voyagerIndex.integrationInstance.id,
        documentIds: [integrationInstance.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.integrationInstance.id,

      documentId: integrationInstance.id,
      tenantIds: [integrationInstance.tenant.id],

      fields: {
        integrationInstanceId: integrationInstance.id,
        integrationId: integrationInstance.integration.id,
        providerIds: integrationInstance.integrationInstanceProviders.map(
          provider => provider.integrationProvider.provider.id
        ),
        integrationProviderIds: integrationInstance.integrationInstanceProviders.map(
          provider => provider.integrationProvider.id
        )
      },
      body: {
        name: integrationInstance.name,
        description: integrationInstance.description,
        integrationName: integrationInstance.integration.name,
        integrationSlug: integrationInstance.integration.slug,
        providerNames: integrationInstance.integrationInstanceProviders.map(
          provider => provider.integrationProvider.provider.name
        )
      }
    });
  }
);
