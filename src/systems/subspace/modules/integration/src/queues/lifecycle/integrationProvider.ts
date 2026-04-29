import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexIntegrationQueue } from '../search/integration';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';

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
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: { integration: true }
    });
    if (!integrationProvider || integrationProvider.status !== 'archived') return;

    await integrationProviderArchiveInstanceProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId
    });
    await indexParentIntegration(data.integrationProviderId);
  });

export let integrationProviderArchiveInstanceProvidersManyQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationProvider/archiveInstanceProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderArchiveInstanceProvidersManyQueueProcessor =
  integrationProviderArchiveInstanceProvidersManyQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId }
    });
    if (!integrationProvider || integrationProvider.status !== 'archived') return;

    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        integrationProviderOid: integrationProvider.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        oid: true,
        id: true,
        integrationInstance: { select: { id: true } }
      }
    });
    if (integrationInstanceProviders.length === 0) return;

    await db.integrationInstanceProvider.updateMany({
      where: {
        oid: {
          in: integrationInstanceProviders.map(
            integrationInstanceProvider => integrationInstanceProvider.oid
          )
        }
      },
      data: { isParentDeleted: true }
    });

    await indexIntegrationInstanceQueue.addMany(
      integrationInstanceProviders.map(provider => ({
        integrationInstanceId: provider.integrationInstance.id
      }))
    );

    let lastIntegrationInstanceProvider =
      integrationInstanceProviders[integrationInstanceProviders.length - 1];
    if (!lastIntegrationInstanceProvider) return;

    await integrationProviderArchiveInstanceProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId,
      cursor: lastIntegrationInstanceProvider.id
    });
  });
