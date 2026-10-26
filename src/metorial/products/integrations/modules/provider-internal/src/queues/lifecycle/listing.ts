import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { processSingleRankQueue } from '../listing/rank';
import { enqueueProviderSpecSearchIndex } from '../search/enqueue';
import { indexProviderListingQueue } from '../search/providerListing';

export let listingCreatedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let listingCreatedQueueProcessor = listingCreatedQueue.process(async data => {
  await listingChangedQueue.add({
    providerListingId: data.providerListingId
  });
});

export let listingUpdatedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let listingUpdatedQueueProcessor = listingUpdatedQueue.process(async data => {
  await listingChangedQueue.add({
    providerListingId: data.providerListingId
  });
});

let listingChangedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/changed',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let listingChangedQueueProcessor = listingChangedQueue.process(async data => {
  await indexProviderListingQueue.add({
    providerListingId: data.providerListingId
  });
  await processSingleRankQueue.add({
    providerListingId: data.providerListingId
  });

  let providerListing = await db.providerListing.findUnique({
    where: { id: data.providerListingId },
    select: { provider: { select: { id: true } } }
  });
  if (providerListing) {
    await enqueueProviderSpecSearchIndex({ providerId: providerListing.provider.id });
  }
});
