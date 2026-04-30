import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { identityInternalService } from '@metorial-subspace/module-identity';
import { syncIntegrationInstanceGroupSessionTemplatesQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { syncIntegrationInstanceSessionTemplatesQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
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
    await syncIntegrationInstanceSessionTemplatesQueue.add({
      integrationInstanceId: data.integrationInstanceId
    });

    await integrationInstanceProviderSyncGroupProvidersManyQueue.add({
      integrationInstanceProviderId: data.integrationInstanceProviderId
    });

    if (integrationInstanceProvider.status === 'archived') {
      let versions = await db.integrationInstanceProviderVersion.findMany({
        where: { integrationInstanceProviderOid: integrationInstanceProvider.oid },
        include: { config: true, authConfig: true }
      });

      let seen = new Set<string>();

      for (let current of versions) {
        if (current.config?.status === 'active') {
          if (seen.has(current.config.oid.toString())) continue;
          seen.add(current.config.oid.toString());

          await providerConfigService.archiveProviderConfig({
            tenant: integrationInstanceProvider.tenant,
            solution: integrationInstanceProvider.solution,
            environment: integrationInstanceProvider.environment,
            providerConfig: current.config,
            _canArchiveOwned: true
          });
        }

        if (current.authConfig?.status === 'active') {
          if (seen.has(current.authConfig.oid.toString())) continue;
          seen.add(current.authConfig.oid.toString());

          await providerAuthConfigService.archiveProviderAuthConfig({
            tenant: integrationInstanceProvider.tenant,
            solution: integrationInstanceProvider.solution,
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

    await syncIntegrationInstanceGroupSessionTemplatesQueue.addMany(
      Array.from(
        new Set(groupProviders.map(provider => provider.integrationInstanceGroup.id))
      ).map(integrationInstanceGroupId => ({ integrationInstanceGroupId }))
    );

    let lastProvider = groupProviders[groupProviders.length - 1];
    if (!lastProvider) return;

    await integrationInstanceProviderSyncGroupProvidersManyQueue.add({
      integrationInstanceProviderId: data.integrationInstanceProviderId,
      cursor: lastProvider.id
    });
  });
