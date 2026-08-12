import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderAuthConfig,
  type ProviderAuthConfigSource,
  type ProviderAuthConfigStatus,
  type ProviderAuthCredentials,
  type ProviderAuthImport,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  assertNoActiveIdentityCredentialAuthConfigLink,
  assertNoActiveIntegrationInstanceProviderAuthConfigLink,
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveProviderAuthCredentials,
  resolveProviderAuthMethods,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkProviderMatch,
  normalizeToolFilters
} from '@metorial-subspace/module-provider-internal';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  getMetorialSolution,
  checkTenant,
  type MetorialFacing,
  type MetorialFacingWithOptionalConsumerActor,
  resolveConsumerActorIds,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import {
  providerAuthConfigArchivedQueue,
  providerAuthConfigUpdatedQueue
} from '../queues/lifecycle/providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerAuthCredentialsService } from './providerAuthCredentials';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authMethod: { include: { specification: { omit: { value: true } } } }
};

export let providerAuthConfigInclude = include;

export type CreateProviderAuthConfigParams = {
  tenant: Tenant;
  environment: Environment;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerDeployment?: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    currentVersion:
      | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
      | null;
  };
  source: ProviderAuthConfigSource;
  credentials?: ProviderAuthCredentials;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    isEphemeral?: boolean;
    isDefault?: boolean;
    authMethodId?: string;
    toolFilters?: PrismaJson.ToolFilter | null;
    config: Record<string, any>;
  };
  import: {
    ip: string | undefined;
    ua: string | undefined;
    note?: string | undefined;
  };
};

export type UpdateProviderAuthConfigParams = {
  tenant: Tenant;
  environment: Environment;
  providerAuthConfig: ProviderAuthConfig & { authMethod: { id: string } };

  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    config?: Record<string, any>;

    authMethodId?: string;
    toolFilters?: PrismaJson.ToolFilter | null;
  };

  import: {
    ip: string | undefined;
    ua: string | undefined;
    note?: string | undefined;
  };
};

export type ArchiveProviderAuthConfigParams = {
  tenant: Tenant;
  environment: Environment;
  providerAuthConfig: ProviderAuthConfig;
  _canArchiveOwned?: boolean;
};

type ListProviderAuthConfigsParams = {
  status?: ProviderAuthConfigStatus[];
  allowDeleted?: boolean;

  search?: string;

  ids?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  availableForUse?: boolean;
  availableForProviderDeploymentId?: string;
  providerAuthCredentialsIds?: string[];
  providerAuthMethodIds?: string[];
  actorIds?: string[];
  consumerIds?: string[];
  identityIds?: string[];
  identityCredentialIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderAuthConfigByIdParams = {
  providerAuthConfigId: string;
  allowDeleted?: boolean;
};

type GetManyProviderAuthConfigsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
};

type GetProviderAuthConfigSchemaParams = {
  provider?: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion?: ProviderVersion;
  providerDeployment?: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    currentVersion:
      | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
      | null;
  };

  providerAuthConfig?: ProviderAuthConfig & { deployment: ProviderDeployment | null };

  authMethodId?: string;
};

class providerAuthConfigServiceImpl {
  async createProviderAuthConfig(
    d: MetorialFacingWithOptionalConsumerActor<CreateProviderAuthConfigParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_config.created:before', eventBase);

    let authConfig = await this.createProviderAuthConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_config.created:after', { ...eventBase, authConfig });

    return authConfig;
  }

  async updateProviderAuthConfig(
    d: MetorialFacingWithOptionalConsumerActor<UpdateProviderAuthConfigParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_config.updated:before', eventBase);

    let authConfig = await this.updateProviderAuthConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_config.updated:after', { ...eventBase, authConfig });

    return authConfig;
  }

  async archiveProviderAuthConfig(
    d: MetorialFacingWithOptionalConsumerActor<ArchiveProviderAuthConfigParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_config.deleted:before', eventBase);

    let authConfig = await this.archiveProviderAuthConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_config.deleted:after', { ...eventBase, authConfig });

    return authConfig;
  }

  async listProviderAuthConfigs(d: MetorialFacing<ListProviderAuthConfigsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderAuthConfigsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderAuthConfigsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderAuthConfigsParams
  ) {
    let actorIds = d.actorIds;
    if (d.consumerIds) {
      let consumerActorIds = await resolveConsumerActorIds(d.consumerIds);
      actorIds = [...new Set([...(actorIds ?? []), ...consumerActorIds])];
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let availableForDeployment = d.availableForProviderDeploymentId
      ? await db.providerDeployment.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            id: d.availableForProviderDeploymentId
          },
          select: { oid: true }
        })
      : null;
    let credentials = await resolveProviderAuthCredentials(ts, d.providerAuthCredentialsIds);
    let authMethods = await resolveProviderAuthMethods(ts, d.providerAuthMethodIds);
    let actors = await resolveIdentityActors(ts, actorIds);
    let identities = await resolveIdentities(ts, d.identityIds);
    let identityCredentials = await resolveIdentityCredentials(ts, d.identityCredentialIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerAuthConfig.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                d.availableForUse
                  ? {
                      owningIntegrationInstanceOid: null,
                      owningIntegrationInstanceProviderOid: null
                    }
                  : undefined!,
                d.availableForProviderDeploymentId
                  ? {
                      OR: [
                        { deploymentOid: null },
                        ...(availableForDeployment
                          ? [{ deploymentOid: availableForDeployment.oid }]
                          : [])
                      ]
                    }
                  : undefined!,
                credentials ? { authCredentialsOid: credentials.in } : undefined!,
                authMethods ? { authMethodOid: authMethods.in } : undefined!,
                actors
                  ? { identityCredentials: { some: { identity: { actor: actors.oidIn } } } }
                  : undefined!,
                identities
                  ? { identityCredentials: { some: { identityOid: identities.in } } }
                  : undefined!,
                identityCredentials
                  ? { identityCredentials: { some: identityCredentials.oidIn } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthConfigById(d: MetorialFacing<GetProviderAuthConfigByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthConfigByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthConfigByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderAuthConfigByIdParams
  ) {
    let solution = await getMetorialSolution();
    let providerAuthConfig = await withTransaction(
      async db =>
        await db.providerAuthConfig.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,

            OR: [
              { id: d.providerAuthConfigId },
              { providerSetupSession: { id: d.providerAuthConfigId } }
            ],

            ...normalizeStatusForGet(d).hasParent
          },
          include
        }),
      { ifExists: true }
    );
    if (!providerAuthConfig)
      throw new ServiceError(notFoundError('provider.auth_config', d.providerAuthConfigId));

    return providerAuthConfig;
  }

  async getManyProviderAuthConfigsByIds(
    d: MetorialFacing<GetManyProviderAuthConfigsByIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderAuthConfigsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderAuthConfigsByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManyProviderAuthConfigsByIdsParams
  ) {
    let solution = await getMetorialSolution();
    return await db.providerAuthConfig.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
  }

  async getProviderAuthConfigSchema(d: MetorialFacing<GetProviderAuthConfigSchemaParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthConfigSchemaInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthConfigSchemaInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderAuthConfigSchemaParams
  ) {
    if (d.providerAuthConfig) {
      let authMethod = await db.providerAuthMethod.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.authMethodOid },
        include: { specification: true, provider: true }
      });
      return {
        provider: authMethod.provider,
        authMethod,
        specification: authMethod.specification
      };
    }

    let provider: (Provider & { defaultVariant: ProviderVariant | null }) | undefined;
    if (d.provider) {
      provider = d.provider;
    } else if (d.providerDeployment) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerDeployment.providerOid },
        include: { defaultVariant: true }
      });
    } else if (d.providerVersion) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerVersion.providerOid },
        include: { defaultVariant: true }
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message:
            'Must provide provider, provider deployment, provider version, or provider auth config to get schema',
          code: 'missing_provider_information'
        })
      );
    }

    let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod({
      tenant: d.tenant,
      environment: d.environment,

      provider,
      providerDeployment: d.providerDeployment,
      authMethodId: d.authMethodId
    });

    return {
      provider,
      authMethod,
      specification: authMethod.specification
    };
  }

  async createProviderAuthConfigInternal(d: CreateProviderAuthConfigParams) {
    checkTenant(d, d.providerDeployment);
    checkDeletedRelation(d.providerDeployment, { allowEphemeral: d.input.isEphemeral });
    checkProviderMatch(d.provider, d.providerDeployment);
    checkProviderMatch(d.provider, d.credentials);

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default provider configs must be associated with a deployment',
          code: 'default_config_requires_deployment'
        })
      );
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          environment: d.environment,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId,
          credentials: d.credentials
        });

      let credentials = d.credentials;

      if (credentials && authMethod.type === 'oauth') {
        credentials =
          await providerAuthCredentialsService.getProviderAuthCredentialsForBackendUseInternal({
            tenant: d.tenant,
            provider: d.provider,
            providerAuthCredentials: credentials,
            providerAuthMethod: authMethod
          });
      }

      let backendRes = await providerAuthConfigInternalService.createBackendProviderAuthConfig(
        {
          tenant: d.tenant,
          environment: d.environment,

          provider: d.provider,
          providerVersion: version,
          authMethod,

          config: d.input.config
        }
      );

      let providerAuthConfig =
        await providerAuthConfigInternalService.createProviderAuthConfigInternal({
          tenant: d.tenant,
          environment: d.environment,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          source: d.source,
          input: {
            ...d.input,
            toolFilters: normalizeToolFilters(d.input.toolFilters)
          },
          import: d.import,
          authMethod,
          credentials,
          backend: backendRes.backend,
          backendProviderAuthConfig: backendRes.backendProviderAuthConfig,
          type: authMethod.type === 'oauth' ? 'oauth_manual' : 'manual'
        });

      let synced = await providerAuthConfigInternalService.syncProviderAuthConfigScopes({
        tenant: d.tenant,
        providerAuthConfig
      });

      return {
        ...synced,
        currentVersion: providerAuthConfig.currentVersion,
        authImport: providerAuthConfig.authImport
      };
    });
  }

  async updateProviderAuthConfigInternal(d: UpdateProviderAuthConfigParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.providerAuthConfig);
    checkDeletedEdit(d.providerAuthConfig, 'update');

    if (d.providerAuthConfig.type === 'oauth_automated') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update automated OAuth provider auth configs',
          code: 'cannot_update_automated_oauth_config'
        })
      );
    }

    return withTransaction(async db => {
      let provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.providerOid },
        include: { defaultVariant: true }
      });
      let providerDeployment = d.providerAuthConfig.deploymentOid
        ? await db.providerDeployment.findFirstOrThrow({
            where: { oid: d.providerAuthConfig.deploymentOid },
            include: { currentVersion: { include: { lockedVersion: true } } }
          })
        : undefined;

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          environment: d.environment,
          provider: provider,
          providerDeployment,
          authMethodId: d.providerAuthConfig.authMethod.id
        });

      if (d.input.authMethodId && d.input.authMethodId !== authMethod.id) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change auth method of existing auth config',
            code: 'cannot_change_auth_method'
          })
        );
      }

      let backendRes = d.input.config
        ? await providerAuthConfigInternalService.createBackendProviderAuthConfig({
            tenant: d.tenant,
            environment: d.environment,

            provider,
            providerVersion: version,
            authMethod,

            config: d.input.config
          })
        : undefined;

      let newConfigVersion = backendRes
        ? await db.providerAuthConfigVersion.create({
            data: {
              ...getId('providerAuthConfigVersion'),
              authConfigOid: d.providerAuthConfig.oid,
              slateAuthConfigOid: backendRes.backendProviderAuthConfig.slateAuthConfig?.oid,
              shuttleAuthConfigOid: backendRes.backendProviderAuthConfig.shuttleAuthConfig?.oid
            }
          })
        : null;
      let fromVersionOid = d.providerAuthConfig.currentVersionOid;

      let config = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid
        },
        data: {
          name: d.input.name?.trim() || d.providerAuthConfig.name,
          description: d.input.description?.trim() || d.providerAuthConfig.description,
          metadata: d.input.metadata ?? d.providerAuthConfig.metadata,
          privateMetadata: d.input.privateMetadata ?? d.providerAuthConfig.privateMetadata,
          toolFilter:
            d.input.toolFilters || d.input.toolFilters === null
              ? normalizeToolFilters(d.input.toolFilters)
              : d.providerAuthConfig.toolFilter,

          currentVersionOid: newConfigVersion?.oid ?? d.providerAuthConfig.currentVersionOid
        },
        include
      });

      let authImport: ProviderAuthImport | undefined;

      if (backendRes && newConfigVersion) {
        let update = await db.providerAuthConfigUpdate.create({
          data: {
            ...getId('providerAuthConfigUpdate'),
            authConfigOid: config.oid,
            fromVersionOid: fromVersionOid,
            toVersionOid: newConfigVersion.oid
          }
        });

        authImport = await db.providerAuthImport.create({
          data: {
            ...getId('providerAuthImport'),

            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,

            authConfigOid: config.oid,
            authConfigUpdateOid: update.oid,
            deploymentOid: d.providerAuthConfig.deploymentOid,

            ip: d.import.ip,
            ua: d.import.ua,
            note: d.import.note,
            metadata: d.input.metadata
          }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigUpdatedQueue.add({ providerAuthConfigId: config.id })
      );

      let synced = await providerAuthConfigInternalService.syncProviderAuthConfigScopes({
        tenant: d.tenant,
        providerAuthConfig: {
          ...config,
          currentVersion: newConfigVersion
        }
      });

      return {
        ...synced,
        authImport
      };
    });
  }

  async archiveProviderAuthConfigInternal(d: ArchiveProviderAuthConfigParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.providerAuthConfig);
    checkDeletedEdit(d.providerAuthConfig, 'archive');
    this.assertCanArchiveOwned(d);
    await assertNoActiveIntegrationInstanceProviderAuthConfigLink({
      tenant: d.tenant,
      environment: d.environment,
      solution,
      authConfigOid: d.providerAuthConfig.oid,
      resourceId: d.providerAuthConfig.id
    });
    await assertNoActiveIdentityCredentialAuthConfigLink({
      tenant: d.tenant,
      environment: d.environment,
      solution,
      authConfigOid: d.providerAuthConfig.oid,
      resourceId: d.providerAuthConfig.id
    });

    return withTransaction(async db => {
      let archivedAt = new Date();
      let providerAuthConfig = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt,
          isDefault: false
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthConfigArchivedQueue.add({
          providerAuthConfigId: providerAuthConfig.id
        })
      );

      return providerAuthConfig;
    });
  }

  private assertCanArchiveOwned(d: {
    providerAuthConfig: ProviderAuthConfig;
    _canArchiveOwned?: boolean;
  }) {
    if (d._canArchiveOwned) return;
    if (
      d.providerAuthConfig.owningIntegrationInstanceOid === null &&
      d.providerAuthConfig.owningIntegrationInstanceProviderOid === null
    ) {
      return;
    }

    throw new ServiceError(
      badRequestError({
        message:
          'Provider auth config is owned by an integration instance provider and cannot be archived directly.',
        code: 'provider_auth_config_owned_archive_not_allowed',
        data: { id: d.providerAuthConfig.id }
      })
    );
  }
}

export let providerAuthConfigService = Service.create(
  'providerAuthConfig',
  () => new providerAuthConfigServiceImpl()
).build();
