import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { providerVersionSyncSpecificationQueue } from '../version/syncSpec';

export let providerVersionCreatedQueue = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/lc/providerVersion/created',
  redisUrl: env.service.REDIS_URL
});

export let providerVersionCreatedQueueProcessor = providerVersionCreatedQueue.process(
  async data => {
    await providerVersionSyncSpecificationQueue.add({
      providerVersionId: data.providerVersionId
    });
  }
);

export let providerVersionUpdatedQueue = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/lc/providerVersion/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerVersionUpdatedQueueProcessor = providerVersionUpdatedQueue.process(
  async data => {
    await providerVersionSyncSpecificationQueue.add({
      providerVersionId: data.providerVersionId
    });
  }
);
