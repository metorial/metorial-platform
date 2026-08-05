import { createQueue } from '@metorial/queue';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
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

export let consumerUpdatedQueue = createQueue<
  | { instanceConsumerId: string; consumerId?: never }
  | { instanceConsumerId?: never; consumerId: string }
>({
  name: 'cons/lc/consumer/updated'
});

export let consumerUpdatedQueueProcessor = consumerUpdatedQueue.process(async data => {
  if (data.instanceConsumerId) {
    await syncPendingStatusForInstanceConsumer(data.instanceConsumerId);

    await syncIdentityConsumerQueue.add({
      identityConsumerId: data.instanceConsumerId
    });

    await indexConsumerSearchQueue.add({
      instanceConsumerId: data.instanceConsumerId
    });
  }

  let consumer = await db.consumer.findFirst({
    where: data.consumerId
      ? { id: data.consumerId }
      : { instanceConsumers: { some: { id: data.instanceConsumerId } } }
  });
  if (!consumer) return;

  await Fabric.fire('consumer.updated:after', { consumer });
});
