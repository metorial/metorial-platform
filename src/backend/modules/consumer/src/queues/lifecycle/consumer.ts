import { createQueue } from '@metorial/queue';
import { indexConsumerSearchQueue } from '../search/consumer';
import { syncIdentityConsumerQueue } from '../syncIdentityConsumer';
import { syncPendingStatusForInstanceConsumer } from './pendingStatus';

export let consumerCreatedQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/lc/consumer/created'
});

export let consumerCreatedQueueProcessor = consumerCreatedQueue.process(async data => {
  await syncPendingStatusForInstanceConsumer(data.instanceConsumerId);

  await syncIdentityConsumerQueue.add({
    identityConsumerId: data.instanceConsumerId
  });

  await indexConsumerSearchQueue.add({
    instanceConsumerId: data.instanceConsumerId
  });
});

export let consumerUpdatedQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/lc/consumer/updated'
});

export let consumerUpdatedQueueProcessor = consumerUpdatedQueue.process(async data => {
  await syncPendingStatusForInstanceConsumer(data.instanceConsumerId);

  await syncIdentityConsumerQueue.add({
    identityConsumerId: data.instanceConsumerId
  });

  await indexConsumerSearchQueue.add({
    instanceConsumerId: data.instanceConsumerId
  });
});
