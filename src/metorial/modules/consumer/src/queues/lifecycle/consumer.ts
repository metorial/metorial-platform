import { createQueue } from '@metorial/queue';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { indexConsumerSearchQueue } from '../search/consumer';
import { syncIdentityConsumerQueue } from '../syncIdentityConsumer';
import { syncPendingStatusForInstanceConsumer } from './pendingStatus';

export let consumerCreatedQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/lc/consumer/created'
});

export let consumerCreatedQueueProcessor = consumerCreatedQueue.process(async data => {
  await syncPendingStatusForInstanceConsumer(data.instanceConsumerId);

  let instanceConsumer = await db.instanceConsumer.findUniqueOrThrow({
    where: { id: data.instanceConsumerId },
    include: { consumer: true }
  });
  await Fabric.fire('consumer.created:after', {
    consumer: instanceConsumer.consumer,
    instanceConsumer
  });

  await metorialResourceService.syncConsumerGraph(instanceConsumer.consumer);

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

  await metorialResourceService.syncConsumerGraph(consumer);
});
