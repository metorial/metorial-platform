import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { processSingleRankQueue } from '../listing/rank';
import { indexProviderListingQueue } from '../search/providerListing';

export let listingCreatedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/created',
  redisUrl: env.service.REDIS_URL
});

export let listingCreatedQueueProcessor = listingCreatedQueue.process(async data => {
  await listingChangedQueue.add({
    providerListingId: data.providerListingId
  });
});

export let listingUpdatedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/updated',
  redisUrl: env.service.REDIS_URL
});

export let listingUpdatedQueueProcessor = listingUpdatedQueue.process(async data => {
  await listingChangedQueue.add({
    providerListingId: data.providerListingId
  });
});

let listingChangedQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/lc/listing/changed',
  redisUrl: env.service.REDIS_URL
});

export let listingChangedQueueProcessor = listingChangedQueue.process(async data => {
  await indexProviderListingQueue.add({
    providerListingId: data.providerListingId
  });
  await processSingleRankQueue.add({
    providerListingId: data.providerListingId
  });
});
