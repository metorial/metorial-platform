import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderConfig,
  type ProviderConfigStatus,
  type ProviderConfigVault,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  assertNoActiveIdentityCredentialConfigLink,
  assertNoActiveIntegrationInstanceProviderConfigLink,
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveProviderSpecifications
} from '@metorial-subspace/list-utils';
import {
  checkProviderMatch,
  normalizeToolFilters,
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveConsumerActorIds,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { Fabric, type AuditSubspaceProviderConfig } from '@metorial/fabric';
import { env } from '../env';
import {
  providerConfigArchivedQueue,
  providerConfigCreatedQueue,
  providerConfigUpdatedQueue
} from '../queues/lifecycle/providerConfig';

let include = {
  provider: true,
  deployment: true,
  specification: true,
  fromVault: {
    include: {
      deployment: true
    }
  }
};

let defaultLock = createLock({
  name: 'sub/dep/pconf/def/lock',
  redisUrl: env.service.REDIS_URL
});

export type CreateProviderConfigParams = {
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
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    isEphemeral?: boolean;
    isDefault?: boolean;
    isForVault?: boolean;
    toolFilters?: PrismaJson.ToolFilter | null;

    config:
      | {
          type: 'vault';
          vault: ProviderConfigVault;
        }
      | {
          type: 'inline';
          data: Record<string, any>;
        };
  };
};

export type UpdateProviderConfigParams = {
  tenant: Tenant;
  environment: Environment;
  providerConfig: ProviderConfig;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    toolFilters?: PrismaJson.ToolFilter | null;
  };
};

export type UpdateProviderConfigFacingParams = Omit<
  UpdateProviderConfigParams,
  'providerConfig'
> & {
  providerConfig: UpdateProviderConfigParams['providerConfig'] & AuditSubspaceProviderConfig;
};

export type ArchiveProviderConfigParams = {
  tenant: Tenant;
  environment: Environment;
  providerConfig: ProviderConfig;
  _canArchiveOwned?: boolean;
};

type ListProviderConfigsParams = {
  search?: string;

  status?: ProviderConfigStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  providerIds?: string[];
  providerSpecificationIds?: string[];
  providerDeploymentIds?: string[];
  availableForUse?: boolean;
  availableForProviderDeploymentId?: string;
  providerConfigVaultIds?: string[];
  actorIds?: string[];
  consumerIds?: string[];
  identityIds?: string[];
  identityCredentialIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderConfigByIdParams = {
  providerConfigId: string;
  allowDeleted?: boolean;
};

type GetManyProviderConfigsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
};

type GetProviderConfigSchemaParams = {
  provider?: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion?: ProviderVersion;
  providerDeployment?: ProviderDeployment & {
    currentVersion: ProviderDeploymentVersion | null;
  };
  providerConfig?: ProviderConfig & { deployment: ProviderDeployment | null };
};

type EnsureDefaultEmptyProviderConfigParams = {
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerDeployment: ProviderDeployment;
};

class providerConfigServiceImpl {
  async listProviderConfigs(d: MetorialFacing<ListProviderConfigsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderConfigsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderConfigsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderConfigsParams
  ) {
    let actorIds = d.actorIds;
    if (d.consumerIds) {
      let consumerActorIds = await resolveConsumerActorIds(d.consumerIds);
      actorIds = [...new Set([...(actorIds ?? []), ...consumerActorIds])];
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let specifications = await resolveProviderSpecifications(ts, d.providerSpecificationIds);
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
    let vaults = await resolveProviderConfigs(ts, d.providerConfigVaultIds);
    let actors = await resolveIdentityActors(ts, actorIds);
    let identities = await resolveIdentities(ts, d.identityIds);
    let identityCredentials = await resolveIdentityCredentials(ts, d.identityCredentialIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerConfig.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              isForVault: false,
              isEphemeral: false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                specifications ? { specificationOid: specifications.in } : undefined!,
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
                vaults ? { fromVaultOid: vaults.in } : undefined!,
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

  async getProviderConfigById(d: MetorialFacing<GetProviderConfigByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderConfigByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderConfigByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderConfigByIdParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providerConfig = await withTransaction(
      async db =>
        await db.providerConfig.findFirst({
          where: {
            id: d.providerConfigId,
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            isForVault: false,
            ...normalizeStatusForGet(d).noParent
          },
          include
        }),
      { ifExists: true }
    );
    if (!providerConfig)
      throw new ServiceError(notFoundError('provider.config', d.providerConfigId));

    return providerConfig;
  }

  async getManyProviderConfigsByIds(d: MetorialFacing<GetManyProviderConfigsByIdsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderConfigsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderConfigsByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManyProviderConfigsByIdsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    return await db.providerConfig.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        isForVault: false,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async getProviderConfigSchema(d: MetorialFacing<GetProviderConfigSchemaParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderConfigSchemaInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderConfigSchemaInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderConfigSchemaParams
  ) {
    if (d.providerConfig) {
      return await db.providerSpecification.findFirstOrThrow({
        where: { oid: d.providerConfig.specificationOid },
        include: { provider: true }
      });
    }

    let providerOid =
      d.provider?.oid ?? d.providerDeployment?.providerOid ?? d.providerVersion?.providerOid;
    if (!providerOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider information is required to determine config schema'
        })
      );
    }

    let provider =
      d.provider ??
      (await db.provider.findFirstOrThrow({
        where: { oid: providerOid },
        include: { defaultVariant: true }
      }));

    let versionOid =
      d.providerVersion?.oid ??
      d.providerDeployment?.currentVersion?.lockedVersionOid ??
      provider.defaultVariant?.currentVersionOid;

    if (!versionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Unable to determine provider version for config schema'
        })
      );
    }

    let version = await db.providerVersion.findFirstOrThrow({
      where: { oid: versionOid },
      include: { specification: { include: { provider: true } } }
    });
    if (!version.specification) {
      throw new ServiceError(
        badRequestError({
          message: 'Specification not discovered for provider'
        })
      );
    }

    return version.specification;
  }

  async createProviderConfig(d: MetorialFacing<CreateProviderConfigParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config.created:before', eventBase);

    let config = await this.createProviderConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config.created:after', { ...eventBase, config });

    return config;
  }

  async updateProviderConfig(d: MetorialFacing<UpdateProviderConfigFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config.updated:before', eventBase);

    let config = await this.updateProviderConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config.updated:after', {
      ...eventBase,
      config,
      previousConfig: d.providerConfig
    });

    return config;
  }

  async archiveProviderConfig(d: MetorialFacing<ArchiveProviderConfigParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config.deleted:before', eventBase);

    let config = await this.archiveProviderConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config.deleted:after', { ...eventBase, config });

    return config;
  }

  async createProviderConfigInternal(d: CreateProviderConfigParams) {
    checkTenant(d, d.providerDeployment);
    checkDeletedRelation(d.provider, { allowEphemeral: d.input.isEphemeral });
    checkDeletedRelation(d.providerDeployment, { allowEphemeral: d.input.isEphemeral });

    if (d.input.config.type === 'vault') {
      checkTenant(d, d.input.config.vault);
      checkDeletedRelation(d.input.config.vault, { allowEphemeral: d.input.isEphemeral });
      checkProviderMatch(d.provider, d.input.config.vault);
    }

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default provider configs must be associated with a deployment',
          code: 'default_config_requires_deployment'
        })
      );
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let ids = getId('providerConfig');

      let data = {
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,
        toolFilter: normalizeToolFilters(d.input.toolFilters),

        isEphemeral: !!d.input.isEphemeral,
        isDefault: !!(d.input.isDefault && d.providerDeployment),
        isForVault: !!d.input.isForVault,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        providerOid: d.provider.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,

        deploymentOid: d.providerDeployment?.oid
      };

      let config = await (async () => {
        if (d.input.config.type === 'vault') {
          if (
            d.input.config.vault.deploymentOid &&
            d.providerDeployment &&
            d.input.config.vault.deploymentOid !== d.providerDeployment.oid
          ) {
            throw new ServiceError(
              preconditionFailedError({
                message: 'Vault is locked to a different deployment',
                code: 'deployment_lock_mismatch'
              })
            );
          }

          let parentConfig = await db.providerConfig.findFirstOrThrow({
            where: {
              oid: d.input.config.vault.configOid,
              tenantOid: d.tenant.oid
            },
            include: { currentVersion: true }
          });

          let config = await db.providerConfig.create({
            data: {
              ...ids,
              ...data,

              status: 'active',

              parentConfigOid: parentConfig.oid,
              fromVaultOid: d.input.config.vault.oid,

              deploymentOid: d.providerDeployment?.oid ?? d.input.config.vault.deploymentOid,
              specificationOid: parentConfig.specificationOid
            }
          });

          let currentVersion = await db.providerConfigVersion.create({
            data: {
              ...getId('providerConfigVersion'),
              configOid: config.oid,
              slateInstanceOid: parentConfig.currentVersion?.slateInstanceOid,
              shuttleConfigOid: parentConfig.currentVersion?.shuttleConfigOid
            }
          });

          return await db.providerConfig.update({
            where: { oid: config.oid },
            data: { currentVersionOid: currentVersion.oid },
            include: { ...include, currentVersion: true }
          });
        }

        let version = await providerDeploymentInternalService.getCurrentVersionOptional({
          provider: d.provider,
          environment: d.environment,
          deployment: d.providerDeployment
        });
        if (!version?.specificationOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot create config without a discovered specification'
            })
          );
        }

        let inner = await backend.deployment.createProviderConfig({
          tenant: d.tenant,
          id: ids.id,
          provider: d.provider,
          providerVariant: d.provider.defaultVariant!,
          deployment: d.providerDeployment ?? null,
          config: d.input.config.data
        });

        let config = await db.providerConfig.create({
          data: {
            ...ids,
            ...data,

            status: 'active',

            deploymentOid: d.providerDeployment?.oid,
            specificationOid: version.specificationOid
          }
        });

        let currentVersion = await db.providerConfigVersion.create({
          data: {
            ...getId('providerConfigVersion'),
            configOid: config.oid,
            slateInstanceOid: inner.slateInstance?.oid,
            shuttleConfigOid: inner.shuttleServerConfig?.oid
          }
        });

        await db.providerConfig.updateMany({
          where: { oid: config.oid },
          data: { currentVersionOid: currentVersion.oid }
        });

        await db.providerConfigUpdate.create({
          data: {
            ...getId('providerConfigUpdate'),
            configOid: config.oid,
            toVersionOid: currentVersion.oid
          }
        });

        if (config.isDefault && d.providerDeployment) {
          await db.providerConfig.updateMany({
            where: {
              isDefault: true,
              deploymentOid: d.providerDeployment.oid,
              oid: { not: config.oid }
            },
            data: { isDefault: false }
          });

          await db.providerDeployment.updateMany({
            where: { oid: d.providerDeployment.oid },
            data: { defaultConfigOid: config.oid }
          });
        }

        return await db.providerConfig.findFirstOrThrow({
          where: { oid: config.oid },
          include: { ...include, currentVersion: true }
        });
      })();

      if (d.providerDeployment) {
        await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair({
          deployment: d.providerDeployment,
          config,
          authConfig: null
        });
      }

      await addAfterTransactionHook(async () =>
        providerConfigCreatedQueue.add({ providerConfigId: config.id })
      );

      return config;
    });
  }

  async ensureDefaultEmptyProviderConfig(
    d: MetorialFacing<EnsureDefaultEmptyProviderConfigParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.ensureDefaultEmptyProviderConfigInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async ensureDefaultEmptyProviderConfigInternal(
    d: { tenant: Tenant; environment: Environment } & EnsureDefaultEmptyProviderConfigParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return withTransaction(
      async db => {
        let currentDefault = await this.getDefaultProviderConfig(d);
        if (currentDefault) return currentDefault;

        return await defaultLock.usingLock(d.provider.id, async () => {
          let currentDefault = await this.getDefaultProviderConfig(d);
          if (currentDefault) return currentDefault;

          let deployment = await db.providerDeployment.findFirstOrThrow({
            where: {
              oid: d.providerDeployment.oid,
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid
            },
            include: {
              provider: true,
              providerVariant: true,
              currentVersion: {
                include: { lockedVersion: true }
              }
            }
          });

          let innerName = deployment.name ?? d.provider.name;
          if (innerName.includes('Default ')) innerName = d.provider.name;

          return await this.createProviderConfigInternal({
            tenant: d.tenant,
            environment: d.environment,
            provider: d.provider,
            providerDeployment: deployment,
            input: {
              name: `Default Config for ${innerName}`,
              description: 'Auto-created by Metorial',
              isDefault: true,
              config: { type: 'inline', data: {} }
            }
          });
        });
      },
      { ifExists: true }
    );
  }

  async updateProviderConfigInternal(d: UpdateProviderConfigParams) {
    await this.assertNotForVault(d);
    checkTenant(d, d.providerConfig);
    checkDeletedEdit(d.providerConfig, 'update');

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return withTransaction(async db => {
      let config = await db.providerConfig.update({
        where: {
          oid: d.providerConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.providerConfig.name,
          description: d.input.description ?? d.providerConfig.description,
          metadata: d.input.metadata ?? d.providerConfig.metadata,
          privateMetadata: d.input.privateMetadata ?? d.providerConfig.privateMetadata,
          toolFilter:
            d.input.toolFilters || d.input.toolFilters === null
              ? normalizeToolFilters(d.input.toolFilters)
              : d.providerConfig.toolFilter
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigUpdatedQueue.add({ providerConfigId: config.id })
      );

      return config;
    });
  }

  async archiveProviderConfigInternal(d: ArchiveProviderConfigParams) {
    await this.assertNotForVault(d);
    checkTenant(d, d.providerConfig);
    checkDeletedEdit(d.providerConfig, 'archive');
    await this.assertNoActiveIntegrationProviderLink(d);
    this.assertCanArchiveOwned(d);

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    await assertNoActiveIntegrationInstanceProviderConfigLink({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      configOid: d.providerConfig.oid,
      resourceId: d.providerConfig.id
    });
    await assertNoActiveIdentityCredentialConfigLink({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      configOid: d.providerConfig.oid,
      resourceId: d.providerConfig.id
    });

    return withTransaction(async db => {
      let archivedAt = new Date();
      let config = await db.providerConfig.update({
        where: {
          oid: d.providerConfig.oid,
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
        providerConfigArchivedQueue.add({ providerConfigId: config.id })
      );

      return config;
    });
  }

  private async getDefaultProviderConfig(d: {
    tenant: Tenant;
    environment: Environment;
    providerDeployment: ProviderDeployment;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    return withTransaction(db =>
      db.providerConfig.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          deploymentOid: d.providerDeployment.oid,
          isDefault: true
        },
        include: { ...include, currentVersion: true }
      })
    );
  }

  private async assertNotForVault(d: { providerConfig: ProviderConfig }) {
    if (d.providerConfig.isForVault) {
      throw new ServiceError(
        badRequestError({
          message: 'Operation not allowed on vault provider configs',
          code: 'vault_config_operation'
        })
      );
    }
  }

  private async assertNoActiveIntegrationProviderLink(d: {
    tenant: Tenant;
    environment: Environment;
    providerConfig: ProviderConfig;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        integration: {
          status: 'active'
        },
        currentVersion: {
          configOid: d.providerConfig.oid
        }
      },
      select: {
        id: true,
        integration: {
          select: {
            id: true
          }
        }
      }
    });
    if (!integrationProvider) return;

    throw new ServiceError(
      badRequestError({
        message:
          'Provider config is linked to an active integration provider and cannot be archived directly.',
        code: 'provider_config_integration_provider_archive_not_allowed',
        data: {
          id: d.providerConfig.id,
          integrationProviderId: integrationProvider.id,
          integrationId: integrationProvider.integration.id
        }
      })
    );
  }

  private assertCanArchiveOwned(d: {
    providerConfig: ProviderConfig;
    _canArchiveOwned?: boolean;
  }) {
    if (d._canArchiveOwned) return;
    if (
      d.providerConfig.owningIntegrationInstanceOid === null &&
      d.providerConfig.owningIntegrationInstanceProviderOid === null
    ) {
      return;
    }

    throw new ServiceError(
      badRequestError({
        message:
          'Provider config is owned by an integration instance provider and cannot be archived directly.',
        code: 'provider_config_owned_archive_not_allowed',
        data: { id: d.providerConfig.id }
      })
    );
  }
}

export let providerConfigService = Service.create(
  'providerConfig',
  () => new providerConfigServiceImpl()
).build();
