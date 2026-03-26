import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderListingQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/dep/sidx/providerListing',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderListingQueueProcessor = indexProviderListingQueue.process(
  async data => {
    let providerListing = await db.providerListing.findUnique({
      where: { id: data.providerListingId },
      include: { provider: { include: { ownerTenant: true } } }
    });
    if (!providerListing) throw new QueueRetryError();

    await voyager.record.index({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.providerListing.id,

      documentId: providerListing.id,
      tenantIds:
        providerListing.provider.access == 'tenant'
          ? [providerListing.provider.ownerTenant?.id ?? '$$NONE$$']
          : [],

      fields: { providerId: providerListing.provider.id, configId: providerListing.id },
      body: {
        name: providerListing.name,
        readme: providerListing.readme,
        description: providerListing.description,
        providerName: providerListing.provider.name
      }
    });
  }
);
