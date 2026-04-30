import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Integration,
  type IntegrationProvider,
  type IntegrationProviderStatus,
  type Provider,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderType,
  type ProviderVariant,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrations,
  resolveProviderAuthCredentials,
  resolveProviderAuthMethods,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import { providerAuthMethodService, providerService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import {
  checkProviderMatch,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  createIntegrationProviderVersion,
  createIntegrationVersion,
  hasMaterialIntegrationProviderChange,
  normalizeIntegrationProviderToolFilter
} from '../lib/versions';
import {
  integrationProviderArchivedQueue,
  integrationProviderCreatedQueue,
  integrationProviderUpdatedQueue
} from '../queues/lifecycle/integrationProvider';
import { integrationProviderVersionInclude } from './integration';

export let integrationProviderInclude = {
  integration: true,
  provider: true,
  currentVersion: {
    include: integrationProviderVersionInclude
  }
};

let resolveAuthMethod = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  provider: Provider & { type: ProviderType; defaultVariant: ProviderVariant | null };
  deployment: ProviderDeployment & { currentVersion: ProviderDeploymentVersion | null };
  hasAuthCredentials: boolean;
}) => {
  let version = await providerDeploymentInternalService.getCurrentVersion({
    environment: d.environment,
    deployment: d.deployment,
    provider: d.provider
  });
  if (!version) return null;

  let paginator = await providerAuthMethodService.listProviderAuthMethods({
    solution: d.solution,
    tenant: d.tenant,
    environment: d.environment,
    providerVersion: version
  });
  let authMethods = await paginator.run({ limit: 100 });
  if (!authMethods.items.length) return null;

  if (!d.hasAuthCredentials && !d.provider.type.supportsOAuthAutoRegistration) {
    let nonOAuth = authMethods.items.find(m => m.type !== 'oauth');
    if (nonOAuth) return nonOAuth;
  }

  let oauth = authMethods.items.find(m => m.type === 'oauth');
  if (oauth) return oauth;

  let defaultAM = authMethods.items.find(m => m.isDefault);
  if (defaultAM) return defaultAM;

  return authMethods.items[0];
};

let validateMaterialInput = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  provider: Provider & { type: ProviderType; defaultVariant: ProviderVariant | null };
  input: {
    providerDeploymentId?: string | null;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
  };
}) => {
  let [deployment, explicitAuthMethod, explicitAuthCredentials, config] = await Promise.all([
    d.input.providerDeploymentId
      ? providerDeploymentService.getProviderDeploymentById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          providerDeploymentId: d.input.providerDeploymentId
        })
      : providerDeploymentService.ensureDefaultProviderDeployment({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          provider: d.provider
        }),
    d.input.providerAuthMethodId
      ? providerAuthMethodService.getProviderAuthMethodById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          providerAuthMethodId: d.input.providerAuthMethodId
        })
      : null,
    d.input.providerAuthCredentialsId
      ? providerAuthCredentialsService.getProviderAuthCredentialsById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          providerAuthCredentialsId: d.input.providerAuthCredentialsId
        })
      : null,
    d.input.providerConfigId
      ? providerConfigService.getProviderConfigById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          providerConfigId: d.input.providerConfigId
        })
      : null
  ]);

  checkDeletedRelation(deployment);
  checkProviderMatch(d.provider, deployment);
  checkProviderMatch(d.provider, explicitAuthMethod);
  checkProviderMatch(d.provider, explicitAuthCredentials);
  checkProviderMatch(d.provider, config);

  if (config?.deploymentOid && config.deploymentOid !== deployment.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'Provider config is not compatible with provider deployment.',
        code: 'provider_config_deployment_mismatch'
      })
    );
  }

  let authMethod = explicitAuthMethod;
  let authCredentials = explicitAuthCredentials;

  if (!authMethod && d.provider.type.supportsAuth) {
    authMethod = await resolveAuthMethod({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      provider: d.provider,
      deployment,
      hasAuthCredentials: !!authCredentials
    });
  }

  if (authCredentials && !authMethod) {
    throw new ServiceError(
      badRequestError({
        message: 'Provider auth credentials provided without auth method.',
        code: 'provider_auth_credentials_without_method'
      })
    );
  }

  if (
    authMethod?.type === 'oauth' &&
    !authCredentials &&
    !d.provider.type.supportsOAuthAutoRegistration
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'OAuth provider auth method requires auth credentials.',
        code: 'oauth_provider_auth_method_requires_credentials'
      })
    );
  }

  return { deployment, authMethod, authCredentials, config };
};

class integrationProviderServiceImpl {
  async listIntegrationProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IntegrationProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    integrationIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerAuthMethodIds?: string[];
    providerAuthCredentialsIds?: string[];
    providerConfigIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let integrations = await resolveIntegrations(d, d.integrationIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let authMethods = await resolveProviderAuthMethods(d, d.providerAuthMethodIds);
    let authCredentials = await resolveProviderAuthCredentials(
      d,
      d.providerAuthCredentialsIds
    );
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments
                  ? { currentVersion: { deploymentOid: deployments.in } }
                  : undefined!,
                authMethods
                  ? { currentVersion: { authMethodOid: authMethods.in } }
                  : undefined!,
                authCredentials
                  ? { currentVersion: { authCredentialsOid: authCredentials.in } }
                  : undefined!,
                configs ? { currentVersion: { configOid: configs.in } } : undefined!,
                d.search
                  ? {
                      OR: [
                        { name: { contains: d.search, mode: 'insensitive' as const } },
                        { description: { contains: d.search, mode: 'insensitive' as const } },
                        {
                          provider: {
                            name: { contains: d.search, mode: 'insensitive' as const }
                          }
                        }
                      ]
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationProviderInclude
          })
      )
    );
  }

  async getIntegrationProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationProviderId: string;
    allowDeleted?: boolean;
  }) {
    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        id: d.integrationProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationProviderInclude
    });
    if (!integrationProvider)
      throw new ServiceError(notFoundError('integration.provider', d.integrationProviderId));

    return integrationProvider;
  }

  async createIntegrationProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    input: {
      providerId: string;
      providerDeploymentId?: string | null;
      providerAuthMethodId?: string | null;
      providerAuthCredentialsId?: string | null;
      providerConfigId?: string | null;
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    let provider = await providerService.getProviderById({
      solution: d.solution,
      tenant: d.tenant,
      environment: d.environment,
      providerId: d.input.providerId
    });
    checkDeletedRelation(provider);

    let material = await validateMaterialInput({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      provider,
      input: d.input
    });

    let toolFilter = normalizeIntegrationProviderToolFilter(d.input.toolFilters);

    return await withTransaction(async db => {
      let existing = await db.integrationProvider.findUnique({
        where: {
          integrationOid_providerOid: {
            integrationOid: d.integration.oid,
            providerOid: provider.oid
          }
        },
        include: { currentVersion: true }
      });

      if (existing?.status === 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Integration already has an active provider for this provider.',
            code: 'integration_provider_exists'
          })
        );
      }

      let integrationProvider = existing
        ? await db.integrationProvider.update({
            where: { oid: existing.oid },
            data: {
              status: 'active',
              archivedAt: null,
              name: d.input.name?.trim() || provider.name,
              description: d.input.description?.trim(),
              metadata: d.input.metadata,
              toolFilter
            }
          })
        : await db.integrationProvider.create({
            data: {
              ...getId('integrationProvider'),
              status: 'active',
              currentVersionIndex: 0,
              name: d.input.name?.trim() || provider.name,
              description: d.input.description?.trim(),
              metadata: d.input.metadata,
              toolFilter,
              integrationOid: d.integration.oid,
              providerOid: provider.oid,
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            }
          });

      await createIntegrationProviderVersion({
        integrationProviderOid: integrationProvider.oid,
        status: 'active',
        deploymentOid: material.deployment.oid,
        authMethodOid: material.authMethod?.oid,
        authCredentialsOid: material.authCredentials?.oid,
        configOid: material.config?.oid,
        toolFilter
      });

      await createIntegrationVersion({ integrationOid: d.integration.oid });

      let res = await db.integrationProvider.findUniqueOrThrow({
        where: { oid: integrationProvider.oid },
        include: integrationProviderInclude
      });

      await addAfterTransactionHook(async () =>
        integrationProviderCreatedQueue.add({ integrationProviderId: res.id })
      );

      return res;
    });
  }

  async updateIntegrationProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationProvider: IntegrationProvider;
    input: {
      providerDeploymentId?: string;
      providerAuthMethodId?: string | null;
      providerAuthCredentialsId?: string | null;
      providerConfigId?: string | null;
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    checkTenant(d, d.integrationProvider);
    checkDeletedEdit(d.integrationProvider, 'update');

    let current = await db.integrationProvider.findUniqueOrThrow({
      where: { oid: d.integrationProvider.oid },
      include: {
        provider: { include: { defaultVariant: true, type: true } },
        currentVersion: {
          include: {
            deployment: true,
            authMethod: true,
            authCredentials: true,
            config: true
          }
        }
      }
    });
    let provider = current.provider;
    if (!current.currentVersion)
      throw new Error('WTF - missing current version for integration provider');

    let material = await validateMaterialInput({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      provider,
      input: {
        providerDeploymentId:
          d.input.providerDeploymentId ?? current.currentVersion.deployment.id,
        providerAuthMethodId:
          d.input.providerAuthMethodId !== undefined
            ? d.input.providerAuthMethodId
            : (current.currentVersion.authMethod?.id ?? null),
        providerAuthCredentialsId:
          d.input.providerAuthCredentialsId !== undefined
            ? d.input.providerAuthCredentialsId
            : (current.currentVersion.authCredentials?.id ?? null),
        providerConfigId:
          d.input.providerConfigId !== undefined
            ? d.input.providerConfigId
            : (current.currentVersion.config?.id ?? null)
      }
    });
    let toolFilter =
      d.input.toolFilters !== undefined
        ? normalizeIntegrationProviderToolFilter(d.input.toolFilters)
        : (current.currentVersion?.toolFilter as PrismaJson.ToolFilter);

    let materialInput = {
      deploymentOid: material.deployment.oid,
      authMethodOid: material.authMethod?.oid ?? null,
      authCredentialsOid: material.authCredentials?.oid ?? null,
      configOid: material.config?.oid ?? null,
      toolFilter
    };
    let materialChanged = hasMaterialIntegrationProviderChange({
      currentVersion: current.currentVersion,
      input: materialInput
    });

    return await withTransaction(async db => {
      let integrationProvider = await db.integrationProvider.update({
        where: {
          oid: d.integrationProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.integrationProvider.name,
          description:
            d.input.description === undefined
              ? d.integrationProvider.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined ? d.integrationProvider.metadata : d.input.metadata,
          toolFilter
        }
      });

      if (materialChanged) {
        await createIntegrationProviderVersion({
          integrationProviderOid: integrationProvider.oid,
          status: 'active',
          deploymentOid: material.deployment.oid,
          authMethodOid: material.authMethod?.oid,
          authCredentialsOid: material.authCredentials?.oid,
          configOid: material.config?.oid,
          toolFilter
        });

        await createIntegrationVersion({ integrationOid: integrationProvider.integrationOid });
      }

      let res = await db.integrationProvider.findUniqueOrThrow({
        where: { oid: integrationProvider.oid },
        include: integrationProviderInclude
      });

      await addAfterTransactionHook(async () =>
        integrationProviderUpdatedQueue.add({ integrationProviderId: res.id })
      );

      return res;
    });
  }

  async archiveIntegrationProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationProvider: IntegrationProvider;
  }) {
    checkTenant(d, d.integrationProvider);
    checkDeletedEdit(d.integrationProvider, 'archive');

    let current = await db.integrationProvider.findUniqueOrThrow({
      where: { oid: d.integrationProvider.oid },
      include: { currentVersion: true }
    });

    return await withTransaction(async db => {
      let integrationProvider = await db.integrationProvider.update({
        where: {
          oid: d.integrationProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });

      if (current.currentVersion) {
        await createIntegrationProviderVersion({
          integrationProviderOid: integrationProvider.oid,
          status: 'archived',
          deploymentOid: current.currentVersion.deploymentOid,
          authMethodOid: current.currentVersion.authMethodOid,
          authCredentialsOid: current.currentVersion.authCredentialsOid,
          configOid: current.currentVersion.configOid,
          toolFilter: current.currentVersion.toolFilter as PrismaJson.ToolFilter
        });
      }

      await createIntegrationVersion({ integrationOid: integrationProvider.integrationOid });

      let res = await db.integrationProvider.findUniqueOrThrow({
        where: { oid: integrationProvider.oid },
        include: integrationProviderInclude
      });

      await addAfterTransactionHook(async () =>
        integrationProviderArchivedQueue.add({ integrationProviderId: res.id })
      );

      return res;
    });
  }
}

export let integrationProviderService = Service.create(
  'integrationProvider',
  () => new integrationProviderServiceImpl()
).build();
