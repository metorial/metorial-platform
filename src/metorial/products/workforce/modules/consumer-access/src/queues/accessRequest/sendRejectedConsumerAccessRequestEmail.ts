import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerAccessRequestRejectedEmail } from '../../email/accessRequestRejected';

export let sendRejectedConsumerAccessRequestEmailQueue = createQueue<{
  consumerAccessRequestId: string;
}>({
  name: 'cons/access-request/sendRejectedEmail',
  workerOpts: {
    concurrency: 10
  }
});

export let sendRejectedConsumerAccessRequestEmailQueueProcessor =
  sendRejectedConsumerAccessRequestEmailQueue.process(async data => {
    let consumerAccessRequest = await db.consumerAccessRequest.findUnique({
      where: {
        id: data.consumerAccessRequestId
      },
      include: {
        surface: {
          include: {
            organization: true
          }
        },
        consumerProfile: true,
        providerTemplate: true,
        magicMcpServer: true
      }
    });

    if (!consumerAccessRequest) throw new QueueRetryError();
    if (consumerAccessRequest.status != 'rejected') return;
    if (!consumerAccessRequest.consumerProfile.email.trim()) return;

    await consumerAccessRequestRejectedEmail.send({
      to: [consumerAccessRequest.consumerProfile.email],
      data: {
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerAccessRequest
      }
    });
  });
