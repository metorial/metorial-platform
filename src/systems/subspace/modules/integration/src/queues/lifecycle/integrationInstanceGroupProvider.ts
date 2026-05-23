import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { queueJobId } from '@metorial-subspace/module-session/src/lib/sessionTemplateSync';
import { enqueueSyncIntegrationInstanceGroupSessionTemplates } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { env } from '../../env';

export let integrationInstanceGroupProviderSetQueue = createQueue<{
  integrationInstanceGroupId: string;
  integrationInstanceGroupProviderId: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroupProvider/set',
  redisUrl: env.service.REDIS_URL
});

export let enqueueIntegrationInstanceGroupProviderSet = async (d: {
  integrationInstanceGroupId: string;
  integrationInstanceGroupProviderId: string;
}) => {
  await integrationInstanceGroupProviderSetQueue.add(d, {
    id: queueJobId('iigp', d.integrationInstanceGroupProviderId)
  });
};

export let enqueueIntegrationInstanceGroupProvidersSet = async (
  items: {
    integrationInstanceGroupId: string;
    integrationInstanceGroupProviderId: string;
  }[]
) => {
  if (!items.length) return;

  await integrationInstanceGroupProviderSetQueue.addManyWithOps(
    items.map(item => ({
      data: item,
      opts: { id: queueJobId('iigp', item.integrationInstanceGroupProviderId) }
    }))
  );
};

export let integrationInstanceGroupProviderSetQueueProcessor =
  integrationInstanceGroupProviderSetQueue.process(async data => {
    let provider = await db.integrationInstanceGroupProvider.findUnique({
      where: { id: data.integrationInstanceGroupProviderId },
      include: { integrationInstanceGroup: true }
    });
    if (!provider) return;

    await enqueueSyncIntegrationInstanceGroupSessionTemplates({
      integrationInstanceGroupId: data.integrationInstanceGroupId
    });
  });
