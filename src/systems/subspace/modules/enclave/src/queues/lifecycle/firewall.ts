import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let firewallCreatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/created',
  redisUrl: env.service.REDIS_URL
});

export let firewallCreatedQueueProcessor = firewallCreatedQueue.process(async () => {});

export let firewallUpdatedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/updated',
  redisUrl: env.service.REDIS_URL
});

export let firewallUpdatedQueueProcessor = firewallUpdatedQueue.process(async () => {});

export let firewallDeletedQueue = createQueue<{ firewallId: string }>({
  name: 'sub/enc/lc/firewall/deleted',
  redisUrl: env.service.REDIS_URL
});

export let firewallDeletedQueueProcessor = firewallDeletedQueue.process(async () => {});
