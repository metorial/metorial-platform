import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let enclaveCreatedQueue = createQueue<{ enclaveId: string }>({
  name: 'sub/enc/lc/enclave/created',
  redisUrl: env.service.REDIS_URL
});

export let enclaveCreatedQueueProcessor = enclaveCreatedQueue.process(async () => {});

export let enclaveUpdatedQueue = createQueue<{ enclaveId: string }>({
  name: 'sub/enc/lc/enclave/updated',
  redisUrl: env.service.REDIS_URL
});

export let enclaveUpdatedQueueProcessor = enclaveUpdatedQueue.process(async () => {});
