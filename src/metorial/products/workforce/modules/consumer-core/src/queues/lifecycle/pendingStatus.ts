import { db } from '@metorial/db';
import { QueueRetryError } from '@metorial/queue';
import { consumerService } from '../../services';

export let syncPendingStatusForInstanceConsumer = async (instanceConsumerId: string) => {
  let instanceConsumer = await db.instanceConsumer.findUnique({
    where: {
      id: instanceConsumerId
    },
    include: {
      consumer: true,
      instance: true
    }
  });
  if (!instanceConsumer) throw new QueueRetryError();

  await consumerService.syncPendingStatus({
    consumer: instanceConsumer.consumer,
    instance: instanceConsumer.instance
  });
};
