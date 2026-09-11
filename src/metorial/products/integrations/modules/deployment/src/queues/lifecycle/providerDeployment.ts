import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { providerAuthConfigArchivedQueue } from '../../../../auth/src/queues/lifecycle/providerAuthConfig';
import { env } from '../../env';
import { reconcileProviderDeploymentMonitorSingleQueue } from '../reconcile/providerDeploymentMonitor';
import { indexProviderDeploymentQueue } from '../search/providerDeployment';
import { providerConfigArchivedQueue } from './providerConfig';
import { providerConfigVaultArchivedQueue } from './providerConfigVault';

export let providerDeploymentCreatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/created',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentCreatedQueueProcessor = providerDeploymentCreatedQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { id: data.providerDeploymentId }
    });

    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
    await reconcileProviderDeploymentMonitorSingleQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerDeployment.tenantOid,
          solutionOid: providerDeployment.solutionOid,
          environmentOid: providerDeployment.environmentOid,
          providerOid: providerDeployment.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerDeployment.tenantOid,
        projectOid: providerDeployment.projectOid,
        solutionOid: providerDeployment.solutionOid,
        environmentOid: providerDeployment.environmentOid,
        instanceOid: providerDeployment.instanceOid,
        providerOid: providerDeployment.providerOid,
        deployments: 1,
        firstDeploymentAt: new Date(),
        lastDeploymentAt: new Date(),
        lastUseAt: new Date()
      },
      update: {
        deployments: { increment: 1 },
        lastDeploymentAt: new Date(),
        lastUseAt: new Date()
      }
    });
  }
);

export let providerDeploymentUpdatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentUpdatedQueueProcessor = providerDeploymentUpdatedQueue.process(
  async data => {
    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
  }
);

export let providerDeploymentArchivedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/archived',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentArchivedQueueProcessor = providerDeploymentArchivedQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId }
    });
    if (!providerDeployment) return;

    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await db.sessionProvider.updateMany({
      where: { deploymentOid: providerDeployment.oid, status: 'active' },
      data: { status: 'archived' }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { deploymentOid: providerDeployment.oid, status: 'active' },
      data: { status: 'archived' }
    });

    await providerDeploymentArchiveConfigsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await providerDeploymentArchiveConfigVaultsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await providerDeploymentArchiveAuthConfigsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });

    await db.providerDeployment.updateMany({
      where: { oid: providerDeployment.oid },
      data: {
        isDefault: false,
        defaultConfigOid: null,
        defaultAuthConfigOid: null
      }
    });
  }
);

export let providerDeploymentArchiveConfigsManyQueue = createQueue<{
  providerDeploymentId: string;
  cursor?: string;
}>({
  name: 'sub/dep/lc/providerDeployment/archiveConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentArchiveConfigsManyQueueProcessor =
  providerDeploymentArchiveConfigsManyQueue.process(async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId }
    });
    if (!providerDeployment || providerDeployment.status !== 'archived') return;

    let archivedAt = providerDeployment.archivedAt ?? new Date();

    let configs = await db.providerConfig.findMany({
      where: {
        deploymentOid: providerDeployment.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (configs.length === 0) return;

    await db.providerConfig.updateMany({
      where: {
        oid: { in: configs.map(config => config.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt, isDefault: false }
    });

    await providerConfigArchivedQueue.addMany(
      configs.map(config => ({
        providerConfigId: config.id
      }))
    );

    let lastConfig = configs[configs.length - 1];
    if (!lastConfig) return;

    await providerDeploymentArchiveConfigsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId,
      cursor: lastConfig.id
    });
  });

export let providerDeploymentArchiveConfigVaultsManyQueue = createQueue<{
  providerDeploymentId: string;
  cursor?: string;
}>({
  name: 'sub/dep/lc/providerDeployment/archiveConfigVaultsMany',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentArchiveConfigVaultsManyQueueProcessor =
  providerDeploymentArchiveConfigVaultsManyQueue.process(async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId }
    });
    if (!providerDeployment || providerDeployment.status !== 'archived') return;

    let archivedAt = providerDeployment.archivedAt ?? new Date();

    let configVaults = await db.providerConfigVault.findMany({
      where: {
        deploymentOid: providerDeployment.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (configVaults.length === 0) return;

    await db.providerConfigVault.updateMany({
      where: {
        oid: { in: configVaults.map(configVault => configVault.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt }
    });

    await providerConfigVaultArchivedQueue.addMany(
      configVaults.map(configVault => ({
        providerConfigVaultId: configVault.id
      }))
    );

    let lastConfigVault = configVaults[configVaults.length - 1];
    if (!lastConfigVault) return;

    await providerDeploymentArchiveConfigVaultsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId,
      cursor: lastConfigVault.id
    });
  });

export let providerDeploymentArchiveAuthConfigsManyQueue = createQueue<{
  providerDeploymentId: string;
  cursor?: string;
}>({
  name: 'sub/dep/lc/providerDeployment/archiveAuthConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentArchiveAuthConfigsManyQueueProcessor =
  providerDeploymentArchiveAuthConfigsManyQueue.process(async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId }
    });
    if (!providerDeployment || providerDeployment.status !== 'archived') return;

    let archivedAt = providerDeployment.archivedAt ?? new Date();

    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        deploymentOid: providerDeployment.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (authConfigs.length === 0) return;

    await db.providerAuthConfig.updateMany({
      where: {
        oid: { in: authConfigs.map(authConfig => authConfig.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt, isDefault: false }
    });

    await providerAuthConfigArchivedQueue.addMany(
      authConfigs.map(authConfig => ({
        providerAuthConfigId: authConfig.id
      }))
    );

    let lastAuthConfig = authConfigs[authConfigs.length - 1];
    if (!lastAuthConfig) return;

    await providerDeploymentArchiveAuthConfigsManyQueue.add({
      providerDeploymentId: data.providerDeploymentId,
      cursor: lastAuthConfig.id
    });
  });

export let providerDeploymentDeletedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/lc/providerDeployment/deleted',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentDeletedQueueProcessor = providerDeploymentDeletedQueue.process(
  async data => {
    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
  }
);
