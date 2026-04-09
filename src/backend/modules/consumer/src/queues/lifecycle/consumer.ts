import { createQueue } from '@metorial/queue';
import { indexConsumerSearchQueue } from '../search/consumer';
import { syncIdentityConsumerQueue } from '../syncIdentityConsumer';

export let consumerCreatedQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/lc/consumer/created'
});

export let consumerCreatedQueueProcessor = consumerCreatedQueue.process(async data => {
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
  await syncIdentityConsumerQueue.add({
    identityConsumerId: data.instanceConsumerId
  });

  await indexConsumerSearchQueue.add({
    instanceConsumerId: data.instanceConsumerId
  });
});

export let enqueueConsumerCreated = async (instanceConsumerId: string) => {
  await consumerCreatedQueue.add({ instanceConsumerId }).catch(error => {
    console.error('[module-consumer] Failed to enqueue consumer create lifecycle', error);
  });
};

export let enqueueConsumerUpdated = async (instanceConsumerId: string) => {
  await consumerUpdatedQueue.add({ instanceConsumerId }).catch(error => {
    console.error('[module-consumer] Failed to enqueue consumer update lifecycle', error);
  });
};
