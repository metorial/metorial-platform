import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { integrationInstanceProviderCredentialSyncQueue } from '@metorial-subspace/module-identity/src/queues/lifecycle/integrationInstanceProviderCredential';
import { env } from '../../env';
import { indexProviderConfigQueue } from '../search/providerConfig';

export let providerConfigCreatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigCreatedQueueProcessor = providerConfigCreatedQueue.process(
  async data => {
    let providerConfig = await db.providerConfig.findUniqueOrThrow({
      where: { id: data.providerConfigId }
    });

    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerConfig.tenantOid,
          solutionOid: providerConfig.solutionOid,
          environmentOid: providerConfig.environmentOid,
          providerOid: providerConfig.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerConfig.tenantOid,
        solutionOid: providerConfig.solutionOid,
        environmentOid: providerConfig.environmentOid,
        providerOid: providerConfig.providerOid,
        configs: 1,
        firstConfigAt: new Date(),
        lastConfigAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        configs: { increment: 1 },
        lastConfigAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerConfigUpdatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigUpdatedQueueProcessor = providerConfigUpdatedQueue.process(
  async data => {
    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });
  }
);

export let providerConfigArchivedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/archived',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigArchivedQueueProcessor = providerConfigArchivedQueue.process(
  async data => {
    let providerConfig = await db.providerConfig.findUnique({
      where: { id: data.providerConfigId },
      include: { deployment: true }
    });
    if (!providerConfig) return;

    let archivedAt = providerConfig.archivedAt ?? new Date();

    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });

    let relatedConfigs = [
      providerConfig.oid,
      ...(await db.providerConfig
        .findMany({
          where: { parentConfigOid: providerConfig.oid },
          select: { oid: true }
        })
        .then(configs => configs.map(config => config.oid)))
    ];

    await db.sessionProvider.updateMany({
      where: { configOid: { in: relatedConfigs }, status: 'active' },
      data: { status: 'archived' }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { configOid: { in: relatedConfigs }, status: 'active' },
      data: { status: 'archived' }
    });

    await db.providerConfig.updateMany({
      where: { oid: { in: relatedConfigs }, status: 'active' },
      data: { status: 'archived', archivedAt }
    });

    if (providerConfig.deploymentOid) {
      await db.providerDeployment.updateMany({
        where: {
          oid: providerConfig.deploymentOid,
          defaultConfigOid: { in: relatedConfigs }
        },
        data: { defaultConfigOid: null }
      });
    }

    let archivedAtForCredentials = providerConfig.archivedAt ?? new Date();

    await db.identityCredential.updateMany({
      where: {
        configOid: { in: relatedConfigs },
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
          configOid: { in: relatedConfigs }
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

export let providerConfigDeletedQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/dep/lc/providerConfig/deleted',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigDeletedQueueProcessor = providerConfigDeletedQueue.process(
  async data => {
    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });
  }
);
