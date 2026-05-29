import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let networkCreatedQueue = createQueue<{ networkId: string }>({
  name: 'sub/enc/lc/network/created',
  redisUrl: env.service.REDIS_URL
});

export let networkCreatedQueueProcessor = networkCreatedQueue.process(async () => {});
