import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let triggerEventProcessQueue = createQueue<{ eventId: string }>({
  name: 'shub/trg/evt/process',
  redisUrl: env.service.REDIS_URL
});

export let triggerEventProcessQueueProcessor = triggerEventProcessQueue.process(async data => {
  // TODO
});
