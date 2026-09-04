import { createSystemAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { consumerAccessService } from '../../services/consumerAccess';
import { sendApprovedConsumerAccessRequestEmailQueue } from '../accessRequest/sendApprovedConsumerAccessRequestEmail';
import { sendRejectedConsumerAccessRequestEmailQueue } from '../accessRequest/sendRejectedConsumerAccessRequestEmail';
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
    if (!consumerAccessRequest) return;

    if (consumerAccessRequest.status == 'rejected') {
      await sendRejectedConsumerAccessRequestEmailQueue.add({
        consumerAccessRequestId: consumerAccessRequest.id
      });
      return;
    }

    if (consumerAccessRequest.status != 'approved') return;

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

    let auditScope = createSystemAuditScope({
      organization: consumerAccessRequest.surface.organization,
      job: 'consumerAccessRequest/approved'
    });

    if (
      consumerAccessRequest.type === 'provider_template' &&
      consumerAccessRequest.providerTemplate?.status === 'active'
    ) {
      await consumerAccessService.createConsumerAccess({
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerGroup,
        auditScope,
        access: {
          type: 'provider_template',
          providerTemplate: consumerAccessRequest.providerTemplate
        }
      });

      await sendApprovedConsumerAccessRequestEmailQueue.add({
        consumerAccessRequestId: consumerAccessRequest.id
      });
      return;
    }

    if (
      consumerAccessRequest.type === 'magic_mcp_server' &&
      consumerAccessRequest.magicMcpServer?.status === 'active'
    ) {
      await consumerAccessService.createConsumerAccess({
        organization: consumerAccessRequest.surface.organization,
        consumerSurface: consumerAccessRequest.surface,
        consumerGroup,
        auditScope,
        access: {
          type: 'magic_mcp_server',
          magicMcpServer: consumerAccessRequest.magicMcpServer
        }
      });

      await sendApprovedConsumerAccessRequestEmailQueue.add({
        consumerAccessRequestId: consumerAccessRequest.id
      });
    }
  });
