import { createQueue } from '@lowerdeck/queue';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueue,
  reconcileSkillProviderLinksForProviderQueue,
  reconcileSkillProviderLinksQueue
} from '@metorial/cargo-module-skill';
import { db } from '@metorial-subspace/db';
import { providerAuthConfigArchivedQueue } from '@metorial-subspace/module-auth/src/queues/lifecycle/providerAuthConfig';
import { providerAuthCredentialsArchivedQueue } from '@metorial-subspace/module-auth/src/queues/lifecycle/providerAuthCredentials';
import { providerConfigArchivedQueue } from '@metorial-subspace/module-deployment/src/queues/lifecycle/providerConfig';
import { providerConfigVaultArchivedQueue } from '@metorial-subspace/module-deployment/src/queues/lifecycle/providerConfigVault';
import { firewallBindingDeletedQueue } from '@metorial-subspace/module-enclave/src/queues/lifecycle/firewallBinding';
import { identityCredentialDeletedQueue } from '@metorial-subspace/module-identity/src/queues/lifecycle/identityCredential';
import { listingUpdatedQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/listing';
import { providerUpdatedQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/provider';
import { indexProviderDeploymentQueue } from '@metorial-subspace/module-deployment/src/queues/search/providerDeployment';
import { env } from '../../env';
import { indexCustomProviderQueue } from '../search/customProvider';

export let customProviderCreatedQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/lc/customProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let customProviderCreatedQueueProcessor = customProviderCreatedQueue.process(
  async data => {
    await indexCustomProviderQueue.add({ customProviderId: data.customProviderId });
  }
);

export let customProviderUpdatedQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/lc/customProvider/updated',
  redisUrl: env.service.REDIS_URL
});

export let customProviderUpdatedQueueProcessor = customProviderUpdatedQueue.process(
  async data => {
    await indexCustomProviderQueue.add({ customProviderId: data.customProviderId });
  }
);

export let customProviderArchivedQueue = createQueue<{ customProviderId: string }>({
  name: 'sub/cpr/lc/customProvider/archived',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchivedQueueProcessor = customProviderArchivedQueue.process(
  async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId },
      include: { provider: true }
    });
    if (!customProvider || customProvider.status !== 'archived') return;

    await indexCustomProviderQueue.add({ customProviderId: data.customProviderId });

    if (!customProvider.provider) return;

    await db.provider.updateMany({
      where: { oid: customProvider.provider.oid, status: 'active' },
      data: { status: 'archived' }
    });
    await providerUpdatedQueue.add({ providerId: customProvider.provider.id });

    let listing = await db.providerListing.findFirst({
      where: { providerOid: customProvider.provider.oid },
      select: { id: true, oid: true }
    });
    if (listing) {
      await db.providerListing.updateMany({
        where: { oid: listing.oid, status: 'active' },
        data: { status: 'archived' }
      });
      await listingUpdatedQueue.add({ providerListingId: listing.id });
    }

    await customProviderArchiveIntegrationProvidersManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveMagicMcpServerProvidersManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveDeploymentsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveConfigsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveAuthConfigsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveAuthCredentialsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveConfigVaultsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveProviderSetupSessionsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveIdentityCredentialsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveSessionProvidersManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveSessionTemplateProvidersManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderDeleteFirewallBindingsManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveSkillResourcesManyQueue.add({
      customProviderId: data.customProviderId
    });
    await customProviderArchiveMonitorsManyQueue.add({
      customProviderId: data.customProviderId
    });
  }
);

export let customProviderArchiveIntegrationProvidersManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveIntegrationProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveIntegrationProvidersManyQueueProcessor =
  customProviderArchiveIntegrationProvidersManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId },
      include: { tenant: true, solution: true }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (integrationProviders.length === 0) return;

    let archivedAt = new Date();
    await db.integrationProvider.updateMany({
      where: {
        oid: { in: integrationProviders.map(integrationProvider => integrationProvider.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt }
    });

    await reconcileSkillProviderLinksForIntegrationProviderQueue.addMany(
      integrationProviders.map(integrationProvider => ({
        integrationProviderId: integrationProvider.id
      }))
    );

    let lastIntegrationProvider = integrationProviders[integrationProviders.length - 1];
    if (!lastIntegrationProvider) return;

    await customProviderArchiveIntegrationProvidersManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastIntegrationProvider.id
    });
  });

export let customProviderArchiveMagicMcpServerProvidersManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveMagicMcpServerProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveMagicMcpServerProvidersManyQueueProcessor =
  customProviderArchiveMagicMcpServerProvidersManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let magicMcpServerProviders = await db.magicMcpServerProvider.findMany({
      where: {
        integrationProvider: {
          tenantOid: customProvider.tenantOid,
          solutionOid: customProvider.solutionOid,
          providerOid: customProvider.providerOid
        },
        status: { in: ['pending', 'active'] },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (magicMcpServerProviders.length === 0) return;

    let archivedAt = new Date();
    await db.magicMcpServerProvider.updateMany({
      where: {
        oid: {
          in: magicMcpServerProviders.map(magicMcpServerProvider => magicMcpServerProvider.oid)
        },
        status: { in: ['pending', 'active'] }
      },
      data: { status: 'archived', archivedAt }
    });

    let lastMagicMcpServerProvider =
      magicMcpServerProviders[magicMcpServerProviders.length - 1];
    if (!lastMagicMcpServerProvider) return;

    await customProviderArchiveMagicMcpServerProvidersManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastMagicMcpServerProvider.id
    });
  });

export let customProviderArchiveDeploymentsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveDeploymentsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveDeploymentsManyQueueProcessor =
  customProviderArchiveDeploymentsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let providerDeployments = await db.providerDeployment.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (providerDeployments.length === 0) return;

    let archivedAt = new Date();
    await db.providerDeployment.updateMany({
      where: {
        oid: { in: providerDeployments.map(deployment => deployment.oid) },
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt,
        isDefault: false,
        defaultConfigOid: null,
        defaultAuthConfigOid: null
      }
    });

    await db.sessionProvider.updateMany({
      where: {
        deploymentOid: { in: providerDeployments.map(deployment => deployment.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });
    await db.sessionTemplateProvider.updateMany({
      where: {
        deploymentOid: { in: providerDeployments.map(deployment => deployment.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });

    await indexProviderDeploymentQueue.addMany(
      providerDeployments.map(deployment => ({
        providerDeploymentId: deployment.id
      }))
    );

    let lastProviderDeployment = providerDeployments[providerDeployments.length - 1];
    if (!lastProviderDeployment) return;

    await customProviderArchiveDeploymentsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastProviderDeployment.id
    });
  });

export let customProviderArchiveConfigsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveConfigsManyQueueProcessor =
  customProviderArchiveConfigsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let configs = await db.providerConfig.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (configs.length === 0) return;

    let archivedAt = new Date();
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

    await customProviderArchiveConfigsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastConfig.id
    });
  });

export let customProviderArchiveAuthConfigsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveAuthConfigsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveAuthConfigsManyQueueProcessor =
  customProviderArchiveAuthConfigsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (authConfigs.length === 0) return;

    let archivedAt = new Date();
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

    await customProviderArchiveAuthConfigsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastAuthConfig.id
    });
  });

export let customProviderArchiveAuthCredentialsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveAuthCredentialsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveAuthCredentialsManyQueueProcessor =
  customProviderArchiveAuthCredentialsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let authCredentials = await db.providerAuthCredentials.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (authCredentials.length === 0) return;

    let archivedAt = new Date();
    await db.providerAuthCredentials.updateMany({
      where: {
        oid: { in: authCredentials.map(authCredential => authCredential.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt, isDefault: false }
    });

    await providerAuthCredentialsArchivedQueue.addMany(
      authCredentials.map(authCredential => ({
        providerAuthCredentialsId: authCredential.id
      }))
    );

    let lastAuthCredentials = authCredentials[authCredentials.length - 1];
    if (!lastAuthCredentials) return;

    await customProviderArchiveAuthCredentialsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastAuthCredentials.id
    });
  });

export let customProviderArchiveConfigVaultsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveConfigVaultsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveConfigVaultsManyQueueProcessor =
  customProviderArchiveConfigVaultsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let configVaults = await db.providerConfigVault.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (configVaults.length === 0) return;

    let archivedAt = new Date();
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

    await customProviderArchiveConfigVaultsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastConfigVault.id
    });
  });

export let customProviderArchiveProviderSetupSessionsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveProviderSetupSessionsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveProviderSetupSessionsManyQueueProcessor =
  customProviderArchiveProviderSetupSessionsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let setupSessions = await db.providerSetupSession.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: { in: ['pending', 'completed', 'failed', 'expired'] },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (setupSessions.length === 0) return;

    await db.providerSetupSession.updateMany({
      where: {
        oid: { in: setupSessions.map(session => session.oid) },
        status: { in: ['pending', 'completed', 'failed', 'expired'] }
      },
      data: { status: 'archived', isParentDeleted: true }
    });

    let lastSetupSession = setupSessions[setupSessions.length - 1];
    if (!lastSetupSession) return;

    await customProviderArchiveProviderSetupSessionsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastSetupSession.id
    });
  });

export let customProviderArchiveIdentityCredentialsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveIdentityCredentialsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveIdentityCredentialsManyQueueProcessor =
  customProviderArchiveIdentityCredentialsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let credentials = await db.identityCredential.findMany({
      where: {
        providerOid: customProvider.providerOid,
        status: 'active',
        identity: {
          tenantOid: customProvider.tenantOid,
          solutionOid: customProvider.solutionOid
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (credentials.length === 0) return;

    let archivedAt = new Date();
    await db.identityCredential.updateMany({
      where: {
        oid: { in: credentials.map(credential => credential.oid) },
        status: 'active'
      },
      data: { status: 'archived', archivedAt }
    });

    await identityCredentialDeletedQueue.addMany(
      credentials.map(credential => ({
        identityCredentialId: credential.id
      }))
    );

    let lastCredential = credentials[credentials.length - 1];
    if (!lastCredential) return;

    await customProviderArchiveIdentityCredentialsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastCredential.id
    });
  });

export let customProviderArchiveSessionProvidersManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveSessionProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveSessionProvidersManyQueueProcessor =
  customProviderArchiveSessionProvidersManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let sessionProviders = await db.sessionProvider.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (sessionProviders.length === 0) return;

    await db.sessionProvider.updateMany({
      where: {
        oid: { in: sessionProviders.map(sessionProvider => sessionProvider.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });

    let lastSessionProvider = sessionProviders[sessionProviders.length - 1];
    if (!lastSessionProvider) return;

    await customProviderArchiveSessionProvidersManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastSessionProvider.id
    });
  });

export let customProviderArchiveSessionTemplateProvidersManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveSessionTemplateProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveSessionTemplateProvidersManyQueueProcessor =
  customProviderArchiveSessionTemplateProvidersManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let sessionTemplateProviders = await db.sessionTemplateProvider.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (sessionTemplateProviders.length === 0) return;

    await db.sessionTemplateProvider.updateMany({
      where: {
        oid: {
          in: sessionTemplateProviders.map(
            sessionTemplateProvider => sessionTemplateProvider.oid
          )
        },
        status: 'active'
      },
      data: { status: 'archived' }
    });

    let lastSessionTemplateProvider =
      sessionTemplateProviders[sessionTemplateProviders.length - 1];
    if (!lastSessionTemplateProvider) return;

    await customProviderArchiveSessionTemplateProvidersManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastSessionTemplateProvider.id
    });
  });

export let customProviderDeleteFirewallBindingsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/deleteFirewallBindingsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderDeleteFirewallBindingsManyQueueProcessor =
  customProviderDeleteFirewallBindingsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let bindings = await db.firewallBinding.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        providerOid: customProvider.providerOid,
        targetType: 'provider',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: {
        firewall: {
          select: { networkOid: true }
        }
      }
    });
    if (bindings.length === 0) return;

    await db.firewallBinding.deleteMany({
      where: { oid: { in: bindings.map(binding => binding.oid) } }
    });

    await firewallBindingDeletedQueue.addMany(
      bindings.map(binding => ({
        firewallNetworkOid: binding.firewall.networkOid.toString(),
        tenantOid: binding.tenantOid.toString(),
        environmentOid: binding.environmentOid.toString(),
        enclaveOid: binding.enclaveOid?.toString() ?? null,
        providerOid: binding.providerOid?.toString() ?? null,
        bindingNetworkOid: binding.networkOid?.toString() ?? null
      }))
    );

    let lastBinding = bindings[bindings.length - 1];
    if (!lastBinding) return;

    await customProviderDeleteFirewallBindingsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastBinding.id
    });
  });

export let customProviderArchiveSkillResourcesManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveSkillResourcesMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveSkillResourcesManyQueueProcessor =
  customProviderArchiveSkillResourcesManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId },
      include: { provider: true }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid ||
      !customProvider.provider
    ) {
      return;
    }

    let skillProviders = await db.skillProvider.findMany({
      where: {
        providerOid: customProvider.providerOid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        id: true,
        oid: true,
        skillOid: true,
        skill: { select: { id: true } },
        item: { select: { id: true, oid: true } }
      }
    });
    if (skillProviders.length === 0) return;

    await db.skillProvider.updateMany({
      where: {
        oid: { in: skillProviders.map(skillProvider => skillProvider.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });
    await db.skillItem.updateMany({
      where: {
        oid: { in: skillProviders.map(skillProvider => skillProvider.item.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });
    await db.skillProviderLink.deleteMany({
      where: {
        providerOid: customProvider.providerOid,
        skillOid: { in: skillProviders.map(skillProvider => skillProvider.skillOid) }
      }
    });

    await reconcileSkillProviderLinksQueue.addMany(
      skillProviders.map(skillProvider => ({
        skillId: skillProvider.skill.id
      }))
    );
    await reconcileSkillProviderLinksForProviderQueue.add({
      providerId: customProvider.provider.id
    });

    let lastSkillProvider = skillProviders[skillProviders.length - 1];
    if (!lastSkillProvider) return;

    await customProviderArchiveSkillResourcesManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastSkillProvider.id
    });
  });

export let customProviderArchiveMonitorsManyQueue = createQueue<{
  customProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cpr/lc/customProvider/archiveMonitorsMany',
  redisUrl: env.service.REDIS_URL
});

export let customProviderArchiveMonitorsManyQueueProcessor =
  customProviderArchiveMonitorsManyQueue.process(async data => {
    let customProvider = await db.customProvider.findUnique({
      where: { id: data.customProviderId }
    });
    if (
      !customProvider ||
      customProvider.status !== 'archived' ||
      !customProvider.providerOid
    ) {
      return;
    }

    let monitors = await db.monitor.findMany({
      where: {
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        providerOid: customProvider.providerOid,
        target: 'schema_change',
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (monitors.length === 0) return;

    await db.monitor.updateMany({
      where: {
        oid: { in: monitors.map(monitor => monitor.oid) },
        status: 'active'
      },
      data: { status: 'archived' }
    });

    let lastMonitor = monitors[monitors.length - 1];
    if (!lastMonitor) return;

    await customProviderArchiveMonitorsManyQueue.add({
      customProviderId: data.customProviderId,
      cursor: lastMonitor.id
    });
  });
