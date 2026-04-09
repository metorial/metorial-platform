import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import {
  deleteConsumerAccessRequestDocument,
  indexConsumerAccessRequestDocument
} from '@metorial/module-search';

export let indexConsumerAccessRequestSearchQueue = createQueue<{
  consumerAccessRequestId: string;
}>({
  name: 'cons/sidx/access-request'
});

export let indexConsumerAccessRequestSearchQueueProcessor =
  indexConsumerAccessRequestSearchQueue.process(async data => {
    let consumerAccessRequest = await db.consumerAccessRequest.findUnique({
      where: {
        id: data.consumerAccessRequestId
      },
      include: {
        surface: {
          include: {
            instance: true
          }
        }
      }
    });
    if (!consumerAccessRequest) {
      await deleteConsumerAccessRequestDocument({
        id: data.consumerAccessRequestId
      });
      return;
    }

    await indexConsumerAccessRequestDocument({
      id: consumerAccessRequest.id,
      instanceId: consumerAccessRequest.surface.instance.id,
      status: consumerAccessRequest.status,
      message: consumerAccessRequest.message,
      resolutionMessage: consumerAccessRequest.resolutionMessage
    });
  });
