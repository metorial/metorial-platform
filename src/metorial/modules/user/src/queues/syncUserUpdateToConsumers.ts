import { syncUserToConsumers } from '@metorial/module-consumer';
import { createQueue } from '@metorial/queue';

export let syncUserUpdateConsumerManyQueue = createQueue<{ userId: string; cursor?: string }>({
  name: 'usr/syncUserUpdateConsumer/many'
});

export let syncUserUpdateConsumerManyQueueProcessor = syncUserUpdateConsumerManyQueue.process(
  async data => {
    await syncUserToConsumers({ userId: data.userId });
  }
);
