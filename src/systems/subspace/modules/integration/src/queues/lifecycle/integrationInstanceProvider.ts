import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { identityInternalService } from '@metorial-subspace/module-identity';
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
