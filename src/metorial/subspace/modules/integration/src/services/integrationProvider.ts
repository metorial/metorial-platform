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
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { integrationProviderVersionInclude } from '../lib/integrationIncludes';
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

export let integrationProviderInclude = {
  integration: true,
  provider: true,
  currentVersion: {
    include: integrationProviderVersionInclude
  }
};

export let MAX_INTEGRATION_PROVIDERS = 50;

let maxIntegrationProvidersError = () =>
  badRequestError({
    message: `Cannot associate more than ${MAX_INTEGRATION_PROVIDERS} providers to an integration`
  });

let resolveAuthMethod = async (d: {
  tenant: Tenant;
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

  let paginator = await providerAuthMethodService.listProviderAuthMethodsInternal({
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
      ? providerDeploymentService.getProviderDeploymentByIdInternal({
          tenant: d.tenant,
          environment: d.environment,
          providerDeploymentId: d.input.providerDeploymentId
        })
      : providerDeploymentService.ensureDefaultProviderDeploymentInternal({
          tenant: d.tenant,
          environment: d.environment,
          provider: d.provider
        }),
    d.input.providerAuthMethodId
      ? providerAuthMethodService.getProviderAuthMethodByIdInternal({
          tenant: d.tenant,
          environment: d.environment,
          providerAuthMethodId: d.input.providerAuthMethodId
        })
      : null,
    d.input.providerAuthCredentialsId
      ? providerAuthCredentialsService.getProviderAuthCredentialsByIdInternal({
          tenant: d.tenant,
          environment: d.environment,
          providerAuthCredentialsId: d.input.providerAuthCredentialsId
        })
      : null,
    d.input.providerConfigId
      ? providerConfigService.getProviderConfigByIdInternal({
          tenant: d.tenant,
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

let inferReconciliationAuthMaterial = async (d: {
  tenant: Tenant;
  environment: Environment;
  deployment: ProviderDeployment & {
    provider: Provider;
    currentVersion: ProviderDeploymentVersion | null;
  };
}) => {
  let provider = await providerService.getProviderByIdInternal({
    tenant: d.tenant,
    environment: d.environment,
    providerId: d.deployment.provider.id
  });
  if (!provider.type.supportsAuth) {
    return {
      authMethodOid: null,
      authCredentialsOid: null
    };
  }

  let credentialsPaginator =
    await providerAuthCredentialsService.listProviderAuthCredentialsInternal({
      tenant: d.tenant,
      environment: d.environment,
      providerIds: [provider.id],
      status: ['active']
    });
  let credentials = await credentialsPaginator.run({ limit: 100 });
  let authCredentials = credentials.items[0] ?? null;
  let authMethod = await resolveAuthMethod({
    tenant: d.tenant,
    environment: d.environment,
    provider,
    deployment: d.deployment,
    hasAuthCredentials: !!authCredentials
  });

  return {
    authMethodOid: authMethod?.oid ?? null,
    authCredentialsOid:
      authCredentials && authMethod?.type === 'oauth' ? authCredentials.oid : null
  };
};

export type ListIntegrationProvidersParams = {
  search?: string;
  includeMagicMcpBackings?: boolean;

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
};

export type GetIntegrationProviderByIdParams = {
  integrationProviderId: string;
  allowDeleted?: boolean;
};

export type CreateIntegrationProviderParams = {
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
};

export type UpdateIntegrationProviderParams = {
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
};

export type ArchiveIntegrationProviderParams = {
  integrationProvider: IntegrationProvider;
};

class integrationProviderServiceImpl {
  private integrationProviderCreateData(d: {
    context: {
      tenant: Tenant;
      solution: Solution;
      environment: Environment;
      integration: Pick<Integration, 'oid'>;
    };
    id: ReturnType<typeof getId>;
    provider: Pick<Provider, 'oid' | 'name'>;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: unknown;
    };
    toolFilter: PrismaJson.ToolFilter;
  }) {
    return {
      ...d.id,
      status: 'active' as const,
      currentVersionIndex: 0,
      name: d.input.name?.trim() || d.provider.name,
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      toolFilter: d.toolFilter,
      integrationOid: d.context.integration.oid,
      providerOid: d.provider.oid,
      tenantOid: d.context.tenant.oid,
      projectOid: d.context.tenant.projectOid,
      solutionOid: d.context.solution.oid,
      environmentOid: d.context.environment.oid,
      instanceOid: d.context.environment.instanceOid
    };
  }

  private integrationProviderUpdateData(d: {
    provider: Pick<Provider, 'name'>;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: unknown;
    };
    toolFilter: PrismaJson.ToolFilter;
  }) {
    return {
      status: 'active' as const,
      archivedAt: null,
      name: d.input.name?.trim() || d.provider.name,
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      toolFilter: d.toolFilter
    };
  }

  async listIntegrationProviders(d: MetorialFacing<ListIntegrationProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationProvidersParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let authMethods = await resolveProviderAuthMethods(ts, d.providerAuthMethodIds);
    let authCredentials = await resolveProviderAuthCredentials(
      ts,
      d.providerAuthCredentialsIds
    );
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solution,
              environmentOid: d.environment.oid,
              OR: d.includeMagicMcpBackings
                ? undefined
                : [
                    { integration: { isMagicMcpBacking: false } },
                    { integration: { providerTemplateBacking: { isNot: null } } }
                  ],

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

  async getIntegrationProviderById(d: MetorialFacing<GetIntegrationProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationProviderByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        id: d.integrationProviderId,
        tenantOid: d.tenant.oid,
        solution,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationProviderInclude
    });
    if (!integrationProvider)
      throw new ServiceError(notFoundError('integration.provider', d.integrationProviderId));

    return integrationProvider;
  }

  async createIntegrationProvider(d: MetorialFacing<CreateIntegrationProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateIntegrationProviderParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    let provider = await providerService.getProviderByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      providerId: d.input.providerId
    });
    checkDeletedRelation(provider);

    let material = await validateMaterialInput({
      tenant: d.tenant,
      environment: d.environment,
      provider,
      input: d.input
    });

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

      let toolFilter =
        d.input.toolFilters === undefined && existing?.currentVersion
          ? (existing.currentVersion.toolFilter as PrismaJson.ToolFilter)
          : normalizeIntegrationProviderToolFilter(d.input.toolFilters);

      let activeProviderCount = await db.integrationProvider.count({
        where: {
          integrationOid: d.integration.oid,
          status: 'active' as const
        }
      });
      if (activeProviderCount >= MAX_INTEGRATION_PROVIDERS) {
        throw new ServiceError(maxIntegrationProvidersError());
      }

      let newId = getId('integrationProvider');
      let integrationProvider = existing
        ? await db.integrationProvider.update({
            where: { oid: existing.oid },
            data: this.integrationProviderUpdateData({
              provider,
              input: d.input,
              toolFilter
            })
          })
        : await db.integrationProvider.create({
            data: this.integrationProviderCreateData({
              context: { ...d, solution },
              id: newId,
              provider,
              input: d.input,
              toolFilter
            })
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

  async ensureIntegrationProviderForDeploymentInternal(d: {
    tenant: Tenant;
    environment: Environment;
    integration: Pick<Integration, 'oid' | 'tenantOid' | 'solutionOid' | 'environmentOid'>;
    input: {
      providerDeploymentId: string;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integration);

    let deployment = await providerDeploymentService.getProviderDeploymentByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      providerDeploymentId: d.input.providerDeploymentId
    });
    let inferredAuth = await inferReconciliationAuthMaterial({
      tenant: d.tenant,
      environment: d.environment,
      deployment
    });

    return await withTransaction(async db => {
      let existing = await db.integrationProvider.findUnique({
        where: {
          integrationOid_providerOid: {
            integrationOid: d.integration.oid,
            providerOid: deployment.providerOid
          }
        },
        include: { currentVersion: true }
      });

      let toolFilter =
        d.input.toolFilters === undefined && existing?.currentVersion
          ? (existing.currentVersion.toolFilter as PrismaJson.ToolFilter)
          : normalizeIntegrationProviderToolFilter(d.input.toolFilters);

      if (existing?.status !== 'active') {
        let activeProviderCount = await db.integrationProvider.count({
          where: {
            integrationOid: d.integration.oid,
            status: 'active' as const
          }
        });
        if (activeProviderCount >= MAX_INTEGRATION_PROVIDERS) {
          throw new ServiceError(maxIntegrationProvidersError());
        }
      }

      let newId = getId('integrationProvider');
      let integrationProvider = await db.integrationProvider.upsert({
        where: {
          integrationOid_providerOid: {
            integrationOid: d.integration.oid,
            providerOid: deployment.providerOid
          }
        },
        create: this.integrationProviderCreateData({
          context: { ...d, solution },
          id: newId,
          provider: deployment.provider,
          input: {
            description: deployment.description ?? deployment.provider.description,
            metadata: deployment.metadata
          },
          toolFilter
        }),
        update: this.integrationProviderUpdateData({
          provider: deployment.provider,
          input: {
            description: deployment.description ?? deployment.provider.description,
            metadata: deployment.metadata
          },
          toolFilter
        })
      });
      let isNew = integrationProvider.id === newId.id;

      let materialInput = {
        deploymentOid: deployment.oid,
        authMethodOid: existing?.currentVersion?.authMethodOid ?? inferredAuth.authMethodOid,
        authCredentialsOid:
          existing?.currentVersion?.authCredentialsOid ?? inferredAuth.authCredentialsOid,
        configOid: existing?.currentVersion?.configOid ?? deployment.defaultConfigOid ?? null,
        toolFilter
      };
      let materialChanged =
        !existing?.currentVersion ||
        hasMaterialIntegrationProviderChange({
          currentVersion: existing.currentVersion,
          input: materialInput
        });

      if (isNew || materialChanged) {
        await createIntegrationProviderVersion({
          integrationProviderOid: integrationProvider.oid,
          status: 'active',
          deploymentOid: deployment.oid,
          authMethodOid: materialInput.authMethodOid,
          authCredentialsOid: materialInput.authCredentialsOid,
          configOid: materialInput.configOid,
          toolFilter
        });

        await createIntegrationVersion({ integrationOid: d.integration.oid });
      }

      let res = await db.integrationProvider.findUniqueOrThrow({
        where: { oid: integrationProvider.oid },
        include: integrationProviderInclude
      });

      await addAfterTransactionHook(async () => {
        if (isNew) {
          await integrationProviderCreatedQueue.add({ integrationProviderId: res.id });
        } else {
          await integrationProviderUpdatedQueue.add({ integrationProviderId: res.id });
        }
      });

      return res;
    });
  }

  async updateIntegrationProvider(d: MetorialFacing<UpdateIntegrationProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateIntegrationProviderParams
  ) {
    let solution = await getMetorialSolution();

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
          solution,
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

  async archiveIntegrationProvider(d: MetorialFacing<ArchiveIntegrationProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.archiveIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationProviderParams
  ) {
    let solution = await getMetorialSolution();

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
          solution,
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
