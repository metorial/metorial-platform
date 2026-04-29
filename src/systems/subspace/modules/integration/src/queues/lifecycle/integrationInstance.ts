import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';

export let integrationInstanceCreatedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceCreatedQueueProcessor = integrationInstanceCreatedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  }
);

export let integrationInstanceUpdatedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceUpdatedQueueProcessor = integrationInstanceUpdatedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  }
);

export let integrationInstanceArchivedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceArchivedQueueProcessor =
  integrationInstanceArchivedQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

    await db.integrationInstanceProvider.updateMany({
      where: { integrationInstanceOid: integrationInstance.oid, status: 'active' },
      data: {
        status: 'archived',
        archivedAt: integrationInstance.archivedAt ?? new Date()
      }
    });

    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  });

export let integrationInstanceDeletedQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/lc/integrationInstance/deleted',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceDeletedQueueProcessor = integrationInstanceDeletedQueue.process(
  async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  }
);
