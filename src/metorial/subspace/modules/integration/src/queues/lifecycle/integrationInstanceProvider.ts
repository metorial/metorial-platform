import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { identityInternalService } from '@metorial-subspace/module-identity';
import { queueJobId } from '@metorial-subspace/module-session/src/lib/sessionTemplateSync';
import { enqueueSyncIntegrationInstanceGroupSessionTemplatesMany } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { enqueueSyncIntegrationInstanceSessionTemplates } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
import { env } from '../../env';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';

let isOwnedByIntegrationInstanceProvider = (
  resource: {
    owningIntegrationInstanceOid: bigint | null;
    owningIntegrationInstanceProviderOid: bigint | null;
  },
  owner: {
    integrationInstanceOid: bigint;
    integrationInstanceProviderOid: bigint;
  }
) =>
  resource.owningIntegrationInstanceOid === owner.integrationInstanceOid &&
  resource.owningIntegrationInstanceProviderOid === owner.integrationInstanceProviderOid;

export let integrationInstanceProviderSetQueue = createQueue<{
  integrationInstanceId: string;
  integrationInstanceProviderId: string;
}>({
  name: 'sub/int/lc/integrationInstanceProvider/set',
  redisUrl: env.service.REDIS_URL
});

export let enqueueIntegrationInstanceProviderSet = async (d: {
  integrationInstanceId: string;
  integrationInstanceProviderId: string;
}) => {
  await integrationInstanceProviderSetQueue.add(d, {
    id: queueJobId('iip', d.integrationInstanceProviderId)
  });
};

export let enqueueIntegrationInstanceProvidersSet = async (
  items: {
    integrationInstanceId: string;
    integrationInstanceProviderId: string;
  }[]
) => {
  if (!items.length) return;

  await integrationInstanceProviderSetQueue.addManyWithOps(
    items.map(item => ({
      data: item,
      opts: { id: queueJobId('iip', item.integrationInstanceProviderId) }
    }))
  );
};

export let integrationInstanceProviderSetQueueProcessor =
  integrationInstanceProviderSetQueue.process(async data => {
    let integrationInstanceProvider = await db.integrationInstanceProvider.findUnique({
      where: { id: data.integrationInstanceProviderId },
      include: { integrationInstance: true, tenant: true, solution: true, environment: true }
    });
    if (!integrationInstanceProvider) return;

    await indexIntegrationInstanceQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });
    await identityInternalService.syncIntegrationInstanceProviderCredential({
      integrationInstanceProviderId: data.integrationInstanceProviderId
    });
    await enqueueSyncIntegrationInstanceSessionTemplates({
      integrationInstanceId: data.integrationInstanceId
    });

    await enqueueIntegrationInstanceProviderSyncGroupProvidersMany({
      integrationInstanceProviderId: data.integrationInstanceProviderId
    });

    if (integrationInstanceProvider.status === 'archived') {
      let versions = await db.integrationInstanceProviderVersion.findMany({
        where: { integrationInstanceProviderOid: integrationInstanceProvider.oid },
        include: { config: true, authConfig: true }
      });

      let seen = new Set<string>();
      let owner = {
        integrationInstanceOid: integrationInstanceProvider.integrationInstanceOid,
        integrationInstanceProviderOid: integrationInstanceProvider.oid
      };

      for (let current of versions) {
        if (
          current.config?.status === 'active' &&
          isOwnedByIntegrationInstanceProvider(current.config, owner)
        ) {
          if (seen.has(current.config.oid.toString())) continue;
          seen.add(current.config.oid.toString());

          await providerConfigService.archiveProviderConfigInternal({
            tenant: integrationInstanceProvider.tenant,
            environment: integrationInstanceProvider.environment,
            providerConfig: current.config,
            _canArchiveOwned: true
          });
        }

        if (
          current.authConfig?.status === 'active' &&
          isOwnedByIntegrationInstanceProvider(current.authConfig, owner)
        ) {
          if (seen.has(current.authConfig.oid.toString())) continue;
          seen.add(current.authConfig.oid.toString());

          await providerAuthConfigService.archiveProviderAuthConfigInternal({
            tenant: integrationInstanceProvider.tenant,
            environment: integrationInstanceProvider.environment,
            providerAuthConfig: current.authConfig,
            _canArchiveOwned: true
          });
        }
      }
    }
  });

export let integrationInstanceProviderSyncGroupProvidersManyQueue = createQueue<{
  integrationInstanceProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationInstanceProvider/syncGroupProvidersMany',
  redisUrl: env.service.REDIS_URL
});

let enqueueIntegrationInstanceProviderSyncGroupProvidersMany = async (d: {
  integrationInstanceProviderId: string;
  cursor?: string;
}) => {
  await integrationInstanceProviderSyncGroupProvidersManyQueue.add(d, {
    id: queueJobId('iipg', d.integrationInstanceProviderId, d.cursor ?? 'start')
  });
};

export let integrationInstanceProviderSyncGroupProvidersManyQueueProcessor =
  integrationInstanceProviderSyncGroupProvidersManyQueue.process(async data => {
    let integrationInstanceProvider = await db.integrationInstanceProvider.findUnique({
      where: { id: data.integrationInstanceProviderId }
    });
    if (!integrationInstanceProvider) return;

    let groupProviders = await db.integrationInstanceGroupProvider.findMany({
      where: {
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: { integrationInstanceGroup: true }
    });
    if (groupProviders.length === 0) return;

    if (integrationInstanceProvider.status === 'archived') {
      await db.integrationInstanceGroupProvider.updateMany({
        where: {
          oid: { in: groupProviders.map(provider => provider.oid) },
          status: 'active'
        },
        data: { isParentDeleted: true }
      });
    }

    await enqueueSyncIntegrationInstanceGroupSessionTemplatesMany(
      Array.from(
        new Set(groupProviders.map(provider => provider.integrationInstanceGroup.id))
      ).map(integrationInstanceGroupId => ({ integrationInstanceGroupId }))
    );

    let lastProvider = groupProviders[groupProviders.length - 1];
    if (!lastProvider) return;

    await enqueueIntegrationInstanceProviderSyncGroupProvidersMany({
      integrationInstanceProviderId: data.integrationInstanceProviderId,
      cursor: lastProvider.id
    });
  });
