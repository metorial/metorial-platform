import { db } from '@metorial/db';
import {
  deleteConsumerGroupDocument,
  indexConsumerGroupDocument
} from '@metorial/module-search';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let indexConsumerGroupSearchQueue = createQueue<{ consumerGroupId: string }>({
  name: 'cons/sidx/group'
});

export let indexConsumerGroupSearchQueueProcessor = indexConsumerGroupSearchQueue.process(
  async data => {
    let consumerGroup = await db.consumerGroup.findUnique({
      where: {
        id: data.consumerGroupId
      },
      include: {
        surface: {
          include: {
            instance: true
          }
        }
      }
    });
    if (!consumerGroup) throw new QueueRetryError();

    if (consumerGroup.status === 'deleted') {
      await deleteConsumerGroupDocument({ id: consumerGroup.id });
      return;
    }

    await indexConsumerGroupDocument({
      id: consumerGroup.id,
      instanceId: consumerGroup.surface.instance.id,
      status: consumerGroup.status,
      name: consumerGroup.name,
      description: consumerGroup.description,
      ssoGroupIds: consumerGroup.ssoGroupIds
    });
  }
);
