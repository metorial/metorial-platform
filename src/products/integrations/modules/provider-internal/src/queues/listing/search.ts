// import { searchService } from '@metorial-subspace/module-search';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let indexProviderListingQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/search/srvlst',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: { max: 20, duration: 1000 }
  }
});

export let indexProviderListingQueueProcessor = indexProviderListingQueue.process(
  async data => {
    let provider = await db.providerListing.findFirst({
      where: {
        id: data.providerListingId
      },
      include: {
        categories: true,
        collections: true
      }
    });
    if (!provider) throw new QueueRetryError();

    // await searchService.indexDocument({
    //   index: 'provider_listing',
    //   document: {
    //     id: provider.id,
    //     name: provider.name,
    //     description: provider.description,
    //     readme: provider.readme,

    //     categories: provider.categories.map(c => ({
    //       id: c.id,
    //       name: c.name
    //     }))
    //   }
    // });
  }
);
