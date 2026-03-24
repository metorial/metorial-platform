import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let sessionCreatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/created',
  redisUrl: env.service.REDIS_URL
});

export let sessionCreatedQueueProcessor = sessionCreatedQueue.process(async data => {});

export let sessionUpdatedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/updated',
  redisUrl: env.service.REDIS_URL
});

export let sessionUpdatedQueueProcessor = sessionUpdatedQueue.process(async data => {});

export let sessionArchivedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/archived',
  redisUrl: env.service.REDIS_URL
});

export let sessionArchivedQueueProcessor = sessionArchivedQueue.process(async data => {});

export let sessionDeletedQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/lc/session/deleted',
  redisUrl: env.service.REDIS_URL
});

export let sessionDeletedQueueProcessor = sessionDeletedQueue.process(async data => {});
