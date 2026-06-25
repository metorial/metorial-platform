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
  type Solution,
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
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
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

class providerConfigServiceImpl {
  async listProviderConfigs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

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
    identityIds?: string[];
    identityCredentialIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let specifications = await resolveProviderSpecifications(d, d.providerSpecificationIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let availableForDeployment = d.availableForProviderDeploymentId
      ? await db.providerDeployment.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            id: d.availableForProviderDeploymentId
          },
          select: { oid: true }
        })
      : null;
    let vaults = await resolveProviderConfigs(d, d.providerConfigVaultIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);
    let identityCredentials = await resolveIdentityCredentials(d, d.identityCredentialIds);

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
              solutionOid: d.solution.oid,
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

  async getProviderConfigById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfigId: string;
    allowDeleted?: boolean;
  }) {
    let providerConfig = await withTransaction(
      async db =>
        await db.providerConfig.findFirst({
          where: {
            id: d.providerConfigId,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
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

  async getManyProviderConfigsByIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids: string[];
    allowDeleted?: boolean;
  }) {
    return await db.providerConfig.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        isForVault: false,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async getProviderConfigSchema(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    provider?: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion?: ProviderVersion;
    providerDeployment?: ProviderDeployment & {
      currentVersion: ProviderDeploymentVersion | null;
    };
    providerConfig?: ProviderConfig & { deployment: ProviderDeployment | null };
  }) {
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

  async createProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
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
  }) {
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
        providerOid: d.provider.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

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

  async ensureDefaultEmptyProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment: ProviderDeployment;
  }) {
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
              solutionOid: d.solution.oid,
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

          return await this.createProviderConfig({
            tenant: d.tenant,
            solution: d.solution,
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

  async updateProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfig: ProviderConfig;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    await this.assertNotForVault(d);
    checkTenant(d, d.providerConfig);
    checkDeletedEdit(d.providerConfig, 'update');

    return withTransaction(async db => {
      let config = await db.providerConfig.update({
        where: {
          oid: d.providerConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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

  async archiveProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfig: ProviderConfig;
    _canArchiveOwned?: boolean;
  }) {
    await this.assertNotForVault(d);
    checkTenant(d, d.providerConfig);
    checkDeletedEdit(d.providerConfig, 'archive');
    await this.assertNoActiveIntegrationProviderLink(d);
    this.assertCanArchiveOwned(d);
    await assertNoActiveIntegrationInstanceProviderConfigLink({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      configOid: d.providerConfig.oid,
      resourceId: d.providerConfig.id
    });
    await assertNoActiveIdentityCredentialConfigLink({
      tenant: d.tenant,
      solution: d.solution,
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
          solutionOid: d.solution.oid,
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
    solution: Solution;
    environment: Environment;
    providerDeployment: ProviderDeployment;
  }) {
    return withTransaction(db =>
      db.providerConfig.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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
    solution: Solution;
    environment: Environment;
    providerConfig: ProviderConfig;
  }) {
    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
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
