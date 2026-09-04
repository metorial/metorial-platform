import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let triggerRawEventMappingQueue = createQueue<{ rawEventId: string }>({
  name: 'shub/trg/evt/map',
  redisUrl: env.service.REDIS_URL
});

export let triggerRawEventMappingQueueProcessor = triggerRawEventMappingQueue.process(async data => {
  // TODO: load the raw event, turn it into a full event, store it, dispatch to per-trigger queues
});
