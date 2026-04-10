import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerAccessRequestApprovedEmail } from '../../email/accessRequestApproved';

export let sendApprovedConsumerAccessRequestEmailQueue = createQueue<{
  consumerAccessRequestId: string;
}>({
  name: 'cons/access-request/sendApprovedEmail',
  workerOpts: {
    concurrency: 10
  }
});

export let sendApprovedConsumerAccessRequestEmailQueueProcessor =
  sendApprovedConsumerAccessRequestEmailQueue.process(async data => {
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
    if (consumerAccessRequest.status != 'approved') return;
    if (!consumerAccessRequest.consumerProfile.email.trim()) return;

    await consumerAccessRequestApprovedEmail.send({
      to: [consumerAccessRequest.consumerProfile.email],
      data: {
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerAccessRequest
      }
    });
  });
