import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { runIntegrationInstanceArchivedEffects } from './integrationInstance';

export let archiveIntegrationInstanceQueue = createQueue<{
  integrationInstanceId: string;
}>({
  name: 'sub/int/lc/integrationInstance/archive',
  redisUrl: env.service.REDIS_URL
});

export let archiveIntegrationInstanceQueueProcessor = archiveIntegrationInstanceQueue.process(
  async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (
      !integrationInstance ||
      integrationInstance.status === 'archived' ||
      integrationInstance.status === 'deleted'
    ) {
      return;
    }

    let archivedAt = new Date();

    await runIntegrationInstanceArchivedEffects({
      integrationInstanceId: integrationInstance.id,
      integrationInstanceOid: integrationInstance.oid,
      archivedAt
    });

    integrationInstance = await db.integrationInstance.update({
      where: { oid: integrationInstance.oid },
      data: {
        status: 'archived',
        archivedAt
      }
    });
  }
);
