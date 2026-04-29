import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';

export let integrationInstanceProviderSetQueue = createQueue<{
  integrationInstanceId: string;
  integrationInstanceProviderId: string;
}>({
  name: 'sub/int/lc/integrationInstanceProvider/set',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceProviderSetQueueProcessor =
  integrationInstanceProviderSetQueue.process(async data => {
    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
  });
