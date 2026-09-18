import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexPublisherQueue } from '../search/publisher';

export let publisherCreatedQueue = createQueue<{ publisherId: string }>({
  name: 'sub/pint/lc/publisher/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let publisherCreatedQueueProcessor = publisherCreatedQueue.process(async data => {
  await indexPublisherQueue.add({ publisherId: data.publisherId });
});

export let publisherUpdatedQueue = createQueue<{ publisherId: string }>({
  name: 'sub/pint/lc/publisher/updated',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let publisherUpdatedQueueProcessor = publisherUpdatedQueue.process(async data => {
  await indexPublisherQueue.add({ publisherId: data.publisherId });
});
