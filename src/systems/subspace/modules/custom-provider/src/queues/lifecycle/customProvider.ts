import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexCustomProviderQueue } from '../search/customProvider';

export let customProviderCreatedQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/lc/customProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let customProviderCreatedQueueProcessor = customProviderCreatedQueue.process(
  async data => {
    await indexCustomProviderQueue.add({ customProviderId: data.customProviderId });
  }
);

export let customProviderUpdatedQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/lc/customProvider/updated',
  redisUrl: env.service.REDIS_URL
});

export let customProviderUpdatedQueueProcessor = customProviderUpdatedQueue.process(
  async data => {
    await indexCustomProviderQueue.add({ customProviderId: data.customProviderId });
  }
);
