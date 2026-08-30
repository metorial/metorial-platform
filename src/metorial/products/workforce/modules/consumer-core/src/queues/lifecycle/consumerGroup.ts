import { createSystemAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { createQueue } from '@metorial/queue';
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
    console.log('Processing consumer group archived queue for consumer group', consumerGroup);
    if (!consumerGroup || consumerGroup.status !== 'archived') return;

    let consumerAccesses = await db.consumerAccess.findMany({
      where: {
        consumerGroupOid: consumerGroup.oid
      },
      include: {
        consumerGroup: true,
        providerTemplate: true,
        magicMcpServer: true,
        skill: true,
        skillTemplate: true,
        skillGroup: true,
        skillMarketplace: true,
        skillPlugin: true,
        listing: true,
        surface: { include: { organization: true } }
      }
    });
    console.log(
      'Found consumer accesses to revoke for archived consumer group',
      consumerAccesses
    );

    let auditScope = createSystemAuditScope({
      organization: consumerGroup.surface.organization,
      job: 'consumerGroup/archivedCleanup'
    });

    for (let consumerAccess of consumerAccesses) {
      await consumerAccessService.deleteConsumerAccess({
        organization: consumerGroup.surface.organization,
        consumerAccess: consumerAccess,
        auditScope
      });
    }

    await db.consumerAccess.deleteMany({
      where: { consumerGroupOid: consumerGroup.oid }
    });

    await indexConsumerGroupSearchQueue.add({
      consumerGroupId: data.consumerGroupId
    });
  }
);
