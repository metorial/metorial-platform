import { db } from '@metorial/db';
import { indexConsumerDocument } from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexConsumerSearchQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/sidx/consumer'
});

export let indexConsumerSearchQueueProcessor = indexConsumerSearchQueue.process(async data => {
  let instanceConsumer = await db.instanceConsumer.findUnique({
    where: {
      id: data.instanceConsumerId
    },
    include: {
      instance: true
    }
  });
  console.log('indexing consumer', data.instanceConsumerId, instanceConsumer);
  if (!instanceConsumer) throw new QueueRetryError();

  await indexConsumerDocument({
    id: instanceConsumer.id,
    instanceId: instanceConsumer.instance.id,
    name: instanceConsumer.name,
    email: instanceConsumer.email
  });
});
