import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { consumerAccessPolicyService } from '../../services/accessPolicy';
import { indexConsumerGroupSearchQueue } from '../search/consumerGroup';

export let consumerGroupCreatedQueue = createQueue<{ consumerGroupId: string }>({
  name: 'cons/lc/group/created'
});

export let consumerGroupCreatedQueueProcessor = consumerGroupCreatedQueue.process(
  async data => {
    await indexConsumerGroupSearchQueue.add({
      consumerGroupId: data.consumerGroupId
    });
  }
);

export let consumerGroupUpdatedQueue = createQueue<{ consumerGroupId: string }>({
  name: 'cons/lc/group/updated'
});

export let consumerGroupUpdatedQueueProcessor = consumerGroupUpdatedQueue.process(
  async data => {
    await indexConsumerGroupSearchQueue.add({
      consumerGroupId: data.consumerGroupId
    });
  }
);

export let consumerGroupArchivedQueue = createQueue<{ consumerGroupId: string }>({
  name: 'cons/lc/group/archived'
});

export let consumerGroupArchivedQueueProcessor = consumerGroupArchivedQueue.process(
  async data => {
    let consumerGroup = await db.consumerGroup.findUnique({
      where: {
        id: data.consumerGroupId
      },
      include: {
        surface: {
          include: {
            organization: true
          }
        }
      }
    });
    if (!consumerGroup || consumerGroup.status !== 'archived') return;

    let consumerAccesses = await db.consumerAccess.findMany({
      where: {
        consumerGroupOid: consumerGroup.oid
      },
      include: {
        consumerGroup: true,
        providerTemplate: true,
        magicMcpServer: true
      }
    });

    for (let consumerAccess of consumerAccesses) {
      await consumerAccessPolicyService.revokeAccessForConsumerAccess({
        organization: consumerGroup.surface.organization,
        consumerAccess
      });
    }

    await db.consumerAccess.deleteMany({
      where: {
        consumerGroupOid: consumerGroup.oid
      }
    });

    await indexConsumerGroupSearchQueue.add({
      consumerGroupId: data.consumerGroupId
    });
  }
);
