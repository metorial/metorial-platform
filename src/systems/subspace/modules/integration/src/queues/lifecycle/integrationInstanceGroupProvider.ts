import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { syncIntegrationInstanceGroupSessionTemplatesQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { env } from '../../env';

export let integrationInstanceGroupProviderSetQueue = createQueue<{
  integrationInstanceGroupId: string;
  integrationInstanceGroupProviderId: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroupProvider/set',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceGroupProviderSetQueueProcessor =
  integrationInstanceGroupProviderSetQueue.process(async data => {
    let provider = await db.integrationInstanceGroupProvider.findUnique({
      where: { id: data.integrationInstanceGroupProviderId },
      include: { integrationInstanceGroup: true }
    });
    if (!provider) return;

    await syncIntegrationInstanceGroupSessionTemplatesQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId
    });
  });
