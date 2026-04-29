import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexIntegrationQueue } from '../search/integration';

let indexParentIntegration = async (integrationProviderId: string) => {
  let integrationProvider = await db.integrationProvider.findUnique({
    where: { id: integrationProviderId },
    include: { integration: true }
  });
  if (!integrationProvider) return;

  await indexIntegrationQueue.add({ integrationId: integrationProvider.integration.id });
};

export let integrationProviderCreatedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderCreatedQueueProcessor = integrationProviderCreatedQueue.process(
  async data => {
    await indexParentIntegration(data.integrationProviderId);
  }
);

export let integrationProviderUpdatedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderUpdatedQueueProcessor = integrationProviderUpdatedQueue.process(
  async data => {
    await indexParentIntegration(data.integrationProviderId);
  }
);

export let integrationProviderArchivedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderArchivedQueueProcessor =
  integrationProviderArchivedQueue.process(async data => {
    await indexParentIntegration(data.integrationProviderId);
  });
