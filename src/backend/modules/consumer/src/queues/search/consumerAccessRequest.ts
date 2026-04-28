import { db } from '@metorial/db';
import {
  deleteConsumerAccessRequestDocument,
  indexConsumerAccessRequestDocument
} from '@metorial/module-search';
import { createQueue } from '@metorial/queue';

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
        consumerProfile: true,
        providerTemplate: true,
        magicMcpServer: true,
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
      resolutionMessage: consumerAccessRequest.resolutionMessage,
      requesterEmail: consumerAccessRequest.consumerProfile.email,
      requesterName: consumerAccessRequest.consumerProfile.name,
      providerName:
        consumerAccessRequest.providerTemplate?.name ??
        consumerAccessRequest.magicMcpServer?.name,
      providerDescription:
        consumerAccessRequest.providerTemplate?.description ??
        consumerAccessRequest.magicMcpServer?.description
    });
  });
