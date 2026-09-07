import { createQueue } from '@lowerdeck/queue';
import { env } from '../env';

export let callbackEventProcessQueue = createQueue<{ callbackEventId: string }>({
  name: 'sub/cb/event/process',
  redisUrl: env.service.REDIS_URL
});

export let callbackEventProcessQueueProcessor = callbackEventProcessQueue.process(
  async data => {
    // TODO: process the callback event (delivery to the tenant's destinations).
  }
);
