import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { consumerAccessService } from '../../services/consumerAccess';
import { indexConsumerAccessRequestSearchQueue } from '../search/consumerAccessRequest';

export let consumerAccessRequestCreatedQueue = createQueue<{
  consumerAccessRequestId: string;
}>({
  name: 'cons/lc/access-request/created'
});

export let consumerAccessRequestCreatedQueueProcessor =
  consumerAccessRequestCreatedQueue.process(async data => {
    await indexConsumerAccessRequestSearchQueue.add({
      consumerAccessRequestId: data.consumerAccessRequestId
    });
  });

export let consumerAccessRequestUpdatedQueue = createQueue<{
  consumerAccessRequestId: string;
  consumerGroupId?: string;
}>({
  name: 'cons/lc/access-request/updated'
});

export let consumerAccessRequestUpdatedQueueProcessor =
  consumerAccessRequestUpdatedQueue.process(async data => {
    await indexConsumerAccessRequestSearchQueue.add({
      consumerAccessRequestId: data.consumerAccessRequestId
    });

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
        consumerProfile: {
          include: {
            personalConsumerGroup: true
          }
        },
        providerTemplate: true,
        magicMcpServer: true
      }
    });
    if (!consumerAccessRequest || consumerAccessRequest.status !== 'approved') return;

    let consumerGroup = data.consumerGroupId
      ? await db.consumerGroup.findFirst({
          where: {
            id: data.consumerGroupId,
            surfaceOid: consumerAccessRequest.surface.oid,
            status: 'active'
          }
        })
      : consumerAccessRequest.consumerProfile.personalConsumerGroup;
    if (!consumerGroup || consumerGroup.status !== 'active') return;

    if (
      consumerAccessRequest.type === 'provider_template' &&
      consumerAccessRequest.providerTemplate?.status === 'active'
    ) {
      await consumerAccessService.createConsumerAccess({
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerGroup,
        access: {
          type: 'provider_template',
          providerTemplate: consumerAccessRequest.providerTemplate
        }
      });
    }

    if (
      consumerAccessRequest.type === 'magic_mcp_server' &&
      consumerAccessRequest.magicMcpServer?.status === 'active'
    ) {
      await consumerAccessService.createConsumerAccess({
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerGroup,
        access: {
          type: 'magic_mcp_server',
          magicMcpServer: consumerAccessRequest.magicMcpServer
        }
      });
    }
  });

export let enqueueConsumerAccessRequestCreated = async (consumerAccessRequestId: string) => {
  await consumerAccessRequestCreatedQueue.add({ consumerAccessRequestId }).catch(error => {
    console.error(
      '[module-consumer] Failed to enqueue consumer access request create lifecycle',
      error
    );
  });
};

export let enqueueConsumerAccessRequestUpdated = async (d: {
  consumerAccessRequestId: string;
  consumerGroupId?: string;
}) => {
  await consumerAccessRequestUpdatedQueue.add(d).catch(error => {
    console.error(
      '[module-consumer] Failed to enqueue consumer access request update lifecycle',
      error
    );
  });
};
