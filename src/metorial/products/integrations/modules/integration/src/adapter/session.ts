import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import {
  type AdapterIntegrationInstanceProvider,
  db,
  type Environment,
  getId,
  type Session,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { buildIntegrationProviderToolFilterChain } from '@metorial-subspace/module-provider-internal';
import { sessionService } from '@metorial-subspace/module-session';
import { createSessionRecord } from '@metorial-subspace/module-session/src/services/_shared/createSession';
import { assertInternalAdapterSupportedBySession } from '@metorial-subspace/module-session/src/services/_shared/internalAdapter';
import { addDays } from 'date-fns';
import { env } from '../env';
import { requireLiveAdapterIntegration } from './helpers';

export let ADAPTER_INSTANCE_PROVIDER_SESSION_MAX_AGE_DAYS = 14;

let adapterInstanceProviderSessionLock = createLock({
  name: 'sub/int/aiip/session/resolve',
  redisUrl: env.service.REDIS_URL
});

let adapterInstanceProviderSessionInclude = {
  currentSession: true,
  adapterIntegration: {
    include: {
      adapterGlobal: true,
      integration: true
    }
  },
  adapterIntegrationInstance: {
    include: {
      integrationInstance: true
    }
  },
  integrationInstanceProvider: {
    include: {
      integration: true,
      integrationInstance: true,
      integrationProvider: true,
      currentVersion: {
        include: {
          integrationProviderVersion: {
            include: {
              deployment: true
            }
          },
          config: true,
          authConfig: true
        }
      }
    }
  }
} as const;

type AdapterInstanceProviderSessionRecord = NonNullable<
  Awaited<ReturnType<typeof loadAdapterInstanceProviderForSession>>
>;

let loadAdapterInstanceProviderForSession = (oid: bigint) =>
  db.adapterIntegrationInstanceProvider.findUnique({
    where: { oid },
    include: adapterInstanceProviderSessionInclude
  });

let getWillRotateAt = (createdAt: Date) =>
  addDays(createdAt, ADAPTER_INSTANCE_PROVIDER_SESSION_MAX_AGE_DAYS);

let hashAdapterInstanceProviderVersion = async (d: {
  deploymentOid: bigint;
  configOid: bigint;
  authConfigOid: bigint | null;
  toolFilter: unknown;
}) =>
  Hash.sha256(
    canonicalize({
      deploymentOid: d.deploymentOid.toString(),
      configOid: d.configOid.toString(),
      authConfigOid: d.authConfigOid?.toString() ?? null,
      toolFilter: d.toolFilter
    })
  );

let getProviderVersionMaterial = (provider: AdapterInstanceProviderSessionRecord) => {
  let currentVersion = provider.integrationInstanceProvider.currentVersion;
  let deployment = currentVersion?.integrationProviderVersion.deployment;
  let config = currentVersion?.config;
  if (!currentVersion || !deployment || !config || !currentVersion.configOid) {
    throw new ServiceError(
      badRequestError({
        code: 'adapter_instance_provider_not_ready',
        message: 'The adapter instance provider does not have a configured version yet.'
      })
    );
  }

  let toolFilter = buildIntegrationProviderToolFilterChain({
    canAttachCustomToolFilters:
      provider.integrationInstanceProvider.integration.canAttachCustomToolFilters,
    canOverrideToolFilters:
      provider.integrationInstanceProvider.integration.canOverrideToolFilters,
    integrationProviderToolFilter: currentVersion.integrationProviderVersion
      .toolFilter as PrismaJson.ToolFilter | null,
    integrationInstanceProviderToolFilter:
      currentVersion.toolFilter as PrismaJson.ToolFilter | null,
    integrationInstanceProviderIsOverride: currentVersion.isOverrideToolFilter
  });

  return {
    currentVersion,
    deployment,
    config,
    authConfig: currentVersion.authConfig,
    toolFilter
  };
};

let shouldRotateAdapterInstanceProviderSession = (d: {
  provider: AdapterInstanceProviderSessionRecord;
  providerHash: string;
}) => {
  let currentSession = d.provider.currentSession;
  if (!currentSession) return true;
  if (currentSession.status !== 'active') return true;
  if (!currentSession.isInternal) return true;
  if (currentSession.adapterGlobalOid !== d.provider.adapterIntegration.adapterGlobalOid) {
    return true;
  }
  if ((d.provider.providerHash ?? null) !== d.providerHash) return true;
  if (d.provider.willRotateSessionAt) {
    return d.provider.willRotateSessionAt.getTime() <= Date.now();
  }

  return (
    Date.now() - currentSession.createdAt.getTime() >=
    ADAPTER_INSTANCE_PROVIDER_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );
};

let requireLiveAdapterInstanceProvider = (
  provider: Pick<AdapterIntegrationInstanceProvider, 'status'>
) => {
  if (provider.status !== 'active') {
    throw new ServiceError(
      badRequestError({
        code: 'adapter_instance_provider_archived',
        message: 'The adapter instance provider is archived.'
      })
    );
  }
};

let rotateAdapterInstanceProviderSession = async (d: {
  tenant: Tenant;
  environment: Environment;
  provider: AdapterInstanceProviderSessionRecord;
  providerHash: string;
  material: ReturnType<typeof getProviderVersionMaterial>;
}) => {
  let previousSession = d.provider.currentSession;
  let adapterGlobal = d.provider.adapterIntegration.adapterGlobal;
  let integrationInstance = d.provider.adapterIntegrationInstance.integrationInstance;

  return withTransaction(async db => {
    let session = await createSessionRecord({
      tenant: d.tenant,
      environment: d.environment,
      isEphemeral: false,
      isInternal: true,
      adapterGlobalOid: adapterGlobal.oid,
      identityActorOid: integrationInstance.identityActorOid ?? null,
      identityOid: integrationInstance.identityOid ?? null,
      input: {
        providers: [
          {
            deploymentId: d.material.deployment.id,
            configId: d.material.config.id,
            authConfigId: d.material.authConfig?.id,
            toolFilters: d.material.toolFilter as PrismaJson.ToolFilter | null
          }
        ]
      }
    });

    await assertInternalAdapterSupportedBySession({
      session,
      adapterGlobalOid: adapterGlobal.oid
    });

    await db.adapterIntegrationInstanceProviderSession.create({
      data: {
        ...getId('adapterIntegrationInstanceProviderSession'),
        status: 'active',
        adapterIntegrationInstanceProviderOid: d.provider.oid,
        sessionOid: session.oid,
        adapterIntegrationInstanceOid: d.provider.adapterIntegrationInstanceOid,
        adapterIntegrationOid: d.provider.adapterIntegrationOid,
        tenantOid: d.provider.tenantOid,
        projectOid: d.provider.projectOid,
        environmentOid: d.provider.environmentOid,
        instanceOid: d.provider.instanceOid,
        solutionOid: d.provider.solutionOid
      }
    });

    await db.adapterIntegrationInstanceProvider.update({
      where: { oid: d.provider.oid },
      data: {
        currentSessionOid: session.oid,
        providerHash: d.providerHash,
        willRotateSessionAt: getWillRotateAt(session.createdAt)
      }
    });

    if (previousSession) {
      await db.adapterIntegrationInstanceProviderSession.updateMany({
        where: {
          adapterIntegrationInstanceProviderOid: d.provider.oid,
          sessionOid: previousSession.oid,
          status: 'active'
        },
        data: { status: 'rotated', rotatedAt: new Date() }
      });

      if (previousSession.status === 'active') {
        await sessionService.archiveSessionInternal({
          tenant: d.tenant,
          environment: d.environment,
          session: previousSession,
          _allowInternalDelete: true
        });
      }
    }

    return session;
  });
};

export let resolveAdapterInstanceProviderSession = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterInstanceProvider: Pick<AdapterIntegrationInstanceProvider, 'oid'>;
}): Promise<Session> => {
  let existing = await loadAdapterInstanceProviderForSession(d.adapterInstanceProvider.oid);
  if (!existing) {
    throw new ServiceError(
      badRequestError({
        code: 'adapter_instance_provider_not_found',
        message: 'The adapter instance provider could not be found.'
      })
    );
  }

  requireLiveAdapterInstanceProvider(existing);
  requireLiveAdapterIntegration(existing.adapterIntegration);

  let material = getProviderVersionMaterial(existing);
  let providerHash = await hashAdapterInstanceProviderVersion({
    deploymentOid: material.currentVersion.integrationProviderVersion.deploymentOid,
    configOid: material.currentVersion.configOid!,
    authConfigOid: material.currentVersion.authConfigOid,
    toolFilter: material.toolFilter
  });

  if (!shouldRotateAdapterInstanceProviderSession({ provider: existing, providerHash })) {
    return existing.currentSession!;
  }

  return await adapterInstanceProviderSessionLock.usingLock(existing.id, async () => {
    let provider = await loadAdapterInstanceProviderForSession(d.adapterInstanceProvider.oid);
    if (!provider) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_instance_provider_not_found',
          message: 'The adapter instance provider could not be found.'
        })
      );
    }

    requireLiveAdapterInstanceProvider(provider);
    requireLiveAdapterIntegration(provider.adapterIntegration);

    let lockedMaterial = getProviderVersionMaterial(provider);
    let lockedHash = await hashAdapterInstanceProviderVersion({
      deploymentOid: lockedMaterial.currentVersion.integrationProviderVersion.deploymentOid,
      configOid: lockedMaterial.currentVersion.configOid!,
      authConfigOid: lockedMaterial.currentVersion.authConfigOid,
      toolFilter: lockedMaterial.toolFilter
    });

    if (!shouldRotateAdapterInstanceProviderSession({ provider, providerHash: lockedHash })) {
      return provider.currentSession!;
    }

    return await rotateAdapterInstanceProviderSession({
      tenant: d.tenant,
      environment: d.environment,
      provider,
      providerHash: lockedHash,
      material: lockedMaterial
    });
  });
};

export let archiveAdapterInstanceProviderSessions = async (d: {
  tenant: Tenant;
  environment: Environment;
  adapterInstanceProvider: Pick<AdapterIntegrationInstanceProvider, 'oid'>;
}) => {
  return withTransaction(async db => {
    let archivedAt = new Date();
    let provider = await db.adapterIntegrationInstanceProvider.findUnique({
      where: { oid: d.adapterInstanceProvider.oid }
    });
    if (!provider) return;

    let history = await db.adapterIntegrationInstanceProviderSession.findMany({
      where: {
        adapterIntegrationInstanceProviderOid: provider.oid,
        status: { notIn: ['archived', 'deleted'] }
      },
      include: { session: true }
    });

    await db.adapterIntegrationInstanceProviderSession.updateMany({
      where: {
        adapterIntegrationInstanceProviderOid: provider.oid,
        status: { notIn: ['archived', 'deleted'] }
      },
      data: { status: 'archived', archivedAt }
    });

    if (provider.currentSessionOid) {
      await db.adapterIntegrationInstanceProvider.update({
        where: { oid: provider.oid },
        data: { currentSessionOid: null, willRotateSessionAt: null, providerHash: null }
      });
    }

    let sessionsToArchive = [
      ...history.map(row => row.session),
      ...(provider.currentSessionOid
        ? history.some(row => row.sessionOid === provider.currentSessionOid)
          ? []
          : [
              await db.session.findUnique({
                where: { oid: provider.currentSessionOid }
              })
            ]
        : [])
    ].filter(
      (session): session is NonNullable<typeof session> =>
        !!session && session.status === 'active'
    );

    for (let session of sessionsToArchive) {
      await sessionService.archiveSessionInternal({
        tenant: d.tenant,
        environment: d.environment,
        session,
        _allowInternalDelete: true
      });
    }
  });
};

export let archiveAdapterInstanceProviderSessionsForInstance = async (d: {
  adapterInstanceOid: bigint;
}) => {
  let adapterInstance = await db.adapterIntegrationInstance.findUnique({
    where: { oid: d.adapterInstanceOid },
    include: { tenant: true, environment: true }
  });
  if (!adapterInstance) return;

  let providers = await db.adapterIntegrationInstanceProvider.findMany({
    where: {
      adapterIntegrationInstanceOid: d.adapterInstanceOid,
      status: { not: 'active' },
      OR: [
        { currentSessionOid: { not: null } },
        { sessions: { some: { status: { in: ['active', 'rotated'] } } } }
      ]
    }
  });

  for (let provider of providers) {
    await archiveAdapterInstanceProviderSessions({
      tenant: adapterInstance.tenant,
      environment: adapterInstance.environment,
      adapterInstanceProvider: provider
    });
  }
};
