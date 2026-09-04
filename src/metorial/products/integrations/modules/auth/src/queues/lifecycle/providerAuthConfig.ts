import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { integrationInstanceProviderCredentialSyncQueue } from '@metorial-subspace/module-identity/src/queues/lifecycle/integrationInstanceProviderCredential';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { indexProviderAuthConfigQueue } from '../search/providerAuthConfig';

let notifyBackendAuthConfigVersionCreated = async (d: { providerAuthConfigId: string }) => {
  let providerAuthConfig = await db.providerAuthConfig.findUnique({
    where: { id: d.providerAuthConfigId },
    include: {
      tenant: true,
      currentVersion: true
    }
  });
  if (!providerAuthConfig?.currentVersion) return;

  let backend = await getBackend({ entity: providerAuthConfig });
  await backend.auth.onProviderAuthConfigVersionCreated({
    tenant: providerAuthConfig.tenant,
    authConfig: providerAuthConfig,
    authConfigVersion: providerAuthConfig.currentVersion
  });
};

export let providerAuthConfigCreatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigCreatedQueueProcessor = providerAuthConfigCreatedQueue.process(
  async data => {
    let providerAuthConfig = await db.providerAuthConfig.findUniqueOrThrow({
      where: { id: data.providerAuthConfigId }
    });

    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
    await notifyBackendAuthConfigVersionCreated({
      providerAuthConfigId: data.providerAuthConfigId
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerAuthConfig.tenantOid,
          solutionOid: providerAuthConfig.solutionOid,
          environmentOid: providerAuthConfig.environmentOid,
          providerOid: providerAuthConfig.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerAuthConfig.tenantOid,
        projectOid: providerAuthConfig.projectOid,
        solutionOid: providerAuthConfig.solutionOid,
        environmentOid: providerAuthConfig.environmentOid,
        instanceOid: providerAuthConfig.instanceOid,
        providerOid: providerAuthConfig.providerOid,
        authConfigs: 1,
        firstAuthConfigAt: new Date(),
        lastAuthConfigAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        authConfigs: { increment: 1 },
        lastAuthConfigAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerAuthConfigUpdatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigUpdatedQueueProcessor = providerAuthConfigUpdatedQueue.process(
  async data => {
    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
    await notifyBackendAuthConfigVersionCreated({
      providerAuthConfigId: data.providerAuthConfigId
    });
  }
);

export let providerAuthConfigArchivedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/archived',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigArchivedQueueProcessor = providerAuthConfigArchivedQueue.process(
  async data => {
    let providerAuthConfig = await db.providerAuthConfig.findUnique({
      where: { id: data.providerAuthConfigId }
    });
    if (!providerAuthConfig) return;

    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });

    await db.sessionProvider.updateMany({
      where: { authConfigOid: providerAuthConfig.oid, status: 'active' },
      data: { status: 'archived' }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { authConfigOid: providerAuthConfig.oid, status: 'active' },
      data: { status: 'archived' }
    });

    if (providerAuthConfig.deploymentOid) {
      await db.providerDeployment.updateMany({
        where: {
          oid: providerAuthConfig.deploymentOid,
          defaultAuthConfigOid: providerAuthConfig.oid
        },
        data: { defaultAuthConfigOid: null }
      });
    }

    let archivedAtForCredentials = providerAuthConfig.archivedAt ?? new Date();

    await db.identityCredential.updateMany({
      where: {
        authConfigOid: providerAuthConfig.oid,
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt: archivedAtForCredentials
      }
    });

    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        status: { not: 'deleted' },
        currentVersion: {
          authConfigOid: providerAuthConfig.oid
        }
      },
      select: { id: true }
    });
    if (integrationInstanceProviders.length) {
      await integrationInstanceProviderCredentialSyncQueue.addMany(
        integrationInstanceProviders.map(integrationInstanceProvider => ({
          integrationInstanceProviderId: integrationInstanceProvider.id
        }))
      );
    }
  }
);

export let providerAuthConfigDeletedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/deleted',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigDeletedQueueProcessor = providerAuthConfigDeletedQueue.process(
  async data => {
    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
  }
);
