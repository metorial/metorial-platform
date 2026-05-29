import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let networkPolicyCreatedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/created',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyCreatedQueueProcessor = networkPolicyCreatedQueue.process(
  async () => {}
);

export let networkPolicyUpdatedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/updated',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyUpdatedQueueProcessor = networkPolicyUpdatedQueue.process(
  async () => {}
);

export let networkPolicyDeletedQueue = createQueue<{ networkPolicyId: string }>({
  name: 'sub/enc/lc/networkPolicy/deleted',
  redisUrl: env.service.REDIS_URL
});

export let networkPolicyDeletedQueueProcessor = networkPolicyDeletedQueue.process(
  async () => {}
);
