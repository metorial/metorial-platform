import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let providerCreatedQueue = createQueue<{ providerId: string }>({
  name: 'sub/pint/lc/provider/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let providerCreatedQueueProcessor = providerCreatedQueue.process(async data => {});

export let providerUpdatedQueue = createQueue<{ providerId: string }>({
  name: 'sub/pint/lc/provider/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let providerUpdatedQueueProcessor = providerUpdatedQueue.process(async data => {});
