import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { syncDelegatedIntegrationInstanceSessionTemplatesQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedDelegatedIntegrationTemplate';
import { env } from '../../env';

export let delegatedIntegrationInstanceProviderSetQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
  delegatedIntegrationInstanceProviderId: string;
}>({
  name: 'sub/int/lc/delegatedIntegrationInstanceProvider/set',
  redisUrl: env.service.REDIS_URL
});

export let delegatedIntegrationInstanceProviderSetQueueProcessor =
  delegatedIntegrationInstanceProviderSetQueue.process(async data => {
    let provider = await db.delegatedIntegrationInstanceProvider.findUnique({
      where: { id: data.delegatedIntegrationInstanceProviderId },
      include: { delegatedIntegrationInstance: true }
    });
    if (!provider) return;

    await syncDelegatedIntegrationInstanceSessionTemplatesQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId
    });
  });
